APP_ID = '167939483377379';

var fbstats = fbstats || {};
fbstats.data_downloader = fbstats.data_downloader || {};
fbstats.fs_bytes = 30 * 1024 * 1024; // 30 MB
API_CALL_DELAY = 2100; // ms
API_TIMEOUT_DELAY = 1000 * 60 * 5; // 5 minutes
API_TIMEOUT_MESSAGE = "Facebook API timed out. Auto-retrying in 5 minutes";

function call_delay(lambda) {
    setTimeout(lambda, API_CALL_DELAY);
}

function round_tenth(num) {
    return parseFloat((Math.round(num * 10) / 10).toFixed(1));
}

function log_fbapi(url, opts) {
    var lambda = function (obj) {
        console.log(obj);
    };
    if (opts == null) FB.api(url, lambda);
    else FB.api(url, opts, lambda);
}

function is_num(num) {
    return !isNaN(num);
}

// fbstats object

// stolen from: http://www.netlobo.com/url_query_string_javascript.html
fbstats.get_url_param = function (name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.href);
    if (results == null) return null;
    else return results[1];
};


fbstats.update_alert = function (type, html) {
    $("#top_notification").removeClass();
    $("#top_notification").addClass("alert alert-" + type);
    $("#top_notification").html(html);
};

fbstats.data_downloader.done = function() {
    fbstats.set_progress_bar(1.0);
    fbstats.print_download_console("Done!");
    $("#retrieve_btn").button('reset');
    fbstats.data.timestamp = (new Date()).toISOString();
    var str = JSON.stringify(fbstats.data);
    console.log(str);

    var lambda = function (arg) {
        // should execute regardless of deletion status
        fbstats.create_file(fbstats.me.id, function (file_entry) {
            file_entry.createWriter(function (file_writer) {
                file_writer.write(new Blob([str], {
                    type: "text/plain"
                }));
                console.log("wrote data to file");
                fbstats.blockUI();
                fbstats.update_from_cache();
            }, fbstats.fs_error_handler);
        });
    };

    fbstats.delete_file(fbstats.me.id, lambda, lambda);
};

fbstats.is_api_error = function (obj) {
    return obj != null && obj.error != null;
};

fbstats.is_api_timeout_error = function (obj) {
    if (fbstats.is_api_error(obj) && obj.error.code == 9) {
        console.log("api timeout error");
        console.log(obj);
    }
    return fbstats.is_api_error(obj) && obj.error.code == 9;
};

fbstats.set_title = function (name) {
    $("#cur_page_title").html(name);
};

fbstats.nav_to = function (name) {
    $("#page_content > div").each(function (idx, obj) {
        $(obj).hide();
    });
    console.log("#" + name + "_content");
    $("#" + name + "_content").show();
    // $('#' + name).click(function(evt){
    //     evt.stopPropagation();
    //     evt.preventDefault();
    //     return false;
    // });
    console.log('nav_to ' + name);
    history.pushState(null, null, '#' + name);
};

fbstats.finish_auth = function () {
    console.log('finish_auth');
    if (fbstats.me != null) {
        fbstats.update_from_cache(function () {
            console.log(window.location.hash);
            var hash = window.location.hash == "" ? "settings" : location.hash.slice(1);
            console.log($("#" + hash));
            fbstats.sim_click($("#" + hash)[0]);
            fbstats.nav_to(hash);
        });
    } else {
        // fbstats.nav_to("settings");
    }
};

fbstats.get_thread_helper_part2 = function (data, idx, len) {
    $.ajax({
        url: data.paging.next,
        dataType: "json",
        success: function (dat) {
            if (fbstats.is_api_timeout_error(data)) {
                fbstats.print_download_console(API_TIMEOUT_MESSAGE);
                setTimeout(function () {
                    fbstats.get_thread_helper_part2(data, idx, len);
                }, API_TIMEOUT_DELAY);
            } else {
                fbstats.get_thread_helper(dat, idx, len);
            }
        }
    });
};

fbstats.get_thread_helper = function (data, idx, len) {
    if (data == null || data.data == null || data.data.length == 0) {
        console.log("At beginning of chat\n");
        call_delay(function () {
            fbstats.get_all_threads_helper(idx + 1, len);
        });
        return; // we reached the beginning of the chat
    }

    console.log(data);

    tbuf = [];

    $.each(data.data, function (idx, msg) {
        if (msg == null || msg.from == null) {
            return;
        }
        cur_message = {};
        cur_message.timestamp = msg.created_time;
        cur_message.from = msg.from.id;
        cur_message.id = parseInt(msg.id.split("_")[1]);
        cur_message.body = msg.message || "";
        console.log(cur_message);
        tbuf.push(cur_message);
    });

    $(tbuf.reverse()).each(function (i, msg) {
        fbstats.data.threads[idx].messages.splice(1, 0, msg);
    });

    var lerp = 1.0 / len;
    fbstats.set_progress_bar((idx / len) + (lerp * (fbstats.data.threads[idx].messages.length / fbstats._tmpcnt[idx])));

    fbstats.print_download_console("Received " + (data.data.length) + " messages");


    call_delay(function () {
        fbstats.get_thread_helper_part2(data, idx, len);
    });
};

fbstats.get_thread_part4 = function (thread, idx, len, data) {
    $.ajax({
        url: data.comments.paging.next,
        dataType: "json",
        success: function (data) {
            if (fbstats.is_api_timeout_error(data)) {
                fbstats.print_download_console(API_TIMEOUT_MESSAGE);
                setTimeout(function () {
                    fbstats.get_thread_part4(thread, idx, len, data);
                }, API_TIMEOUT_DELAY);
            } else {
                fbstats.get_thread_helper(data, idx, len);
            }
        }
    });
};

fbstats.get_thread_part3 = function (thread, idx, len, data) {
    FB.api('fql', {
        q: ('SELECT created_time FROM message WHERE thread_id="' + thread.id + '" LIMIT 1')
    }, function (response) {
        if (fbstats.is_api_timeout_error(response)) {
            fbstats.print_download_console(API_TIMEOUT_MESSAGE);
            setTimeout(function () {
                fbstats.get_thread_part3(thread, idx, len, data);
            }, API_TIMEOUT_DELAY);
        } else {
            var the_date = new Date(response.data[0].created_time * 1000); // convert to ms
            initial_message.timestamp = the_date.toISOString();
            thread.messages.push(initial_message);

            tbuf = [];

            var cnt = 0;

            if (data != null && data.comments != null && data.comments.data != null) {
                $.each(data.comments.data, function (idx, msg) {
                    if (msg == null || msg.from == null) {
                        return;
                    }
                    cur_message = {};
                    cur_message.timestamp = msg.created_time;
                    cur_message.from = msg.from.id;
                    cur_message.id = parseInt(msg.id.split("_")[1]);
                    var tmp = msg.id.split('_');
                    if (tmp.length >= 2) {
                        cnt = parseInt(tmp[1]);
                    }
                    cur_message.body = msg.message || "";
                    console.log(cur_message);
                    tbuf.push(cur_message);
                });
                fbstats._tmpcnt[idx] = cnt;

                $(tbuf.reverse()).each(function (idx, msg) {
                    thread.messages.splice(1, 0, msg);
                });

                fbstats.print_download_console("Received " + (data.comments.data.length + 1) + " messages");

                var lerp = 1.0 / len;
                fbstats.set_progress_bar((idx / len) + (lerp * (thread.messages.length / cnt)));

                call_delay(function () {
                    fbstats.get_thread_part4(thread, idx, len, data);
                });
            } else {
                console.log("At beginning of chat\n");
                call_delay(function () {
                    fbstats.get_all_threads_helper(idx + 1, len);
                });
            }
        }

    });
};

fbstats.get_thread_part2 = function (thread, idx, len, data) {
    if (fbstats.is_api_timeout_error(data)) {
        fbstats.print_download_console(API_TIMEOUT_MESSAGE);
        setTimeout(function () {
            fbstats.get_thread_part2(thread, idx, len, data);
        }, API_TIMEOUT_DELAY);
    } else {
        console.log(data);
        initial_message = {};
        initial_message.from = data.from.id;
        initial_message.body = data.message || "";
        initial_message.id = 0; // message id is THREADID_NUM

        fbstats.print_download_console("Thread " + (idx + 1) + " of " + len + " -> People: " + thread.people.map(function (id) {
            return fbstats.data.people[id].name;
        }).join(", "));

        /*
            So apparently the Facebook Graph API doesn't give you the created_time of the first message.
            We use FQL to extract this information.
            Thank this person: http://stackoverflow.com/questions/11762428/read-created-time-of-first-message-in-conversation
        */

        call_delay(function () {
            fbstats.get_thread_part3(thread, idx, len, data);
        });
    }
};

fbstats.get_thread_messages_helper = function(thread, idx, len, data) {
    $.ajax({
        url: data.paging.next,
        dataType: "json",
        success: function (d) {
            if (fbstats.is_api_timeout_error(d)) {
                fbstats.print_download_console(API_TIMEOUT_MESSAGE);
                setTimeout(function () {
                    fbstats.get_thread_messages_helper(thread, idx, len, d);
                }, API_TIMEOUT_DELAY);
            } else {
                fbstats.get_thread_messages(thread, idx, len, d);
            }
        }
    });
};

fbstats.get_thread_messages = function(thread, idx, len, data) {
    console.assert(data != null);
    console.assert(data.data != null);
    if (data == null || data.data == null)
    {
    }
    if (data.data.length == 0)
    {
        // reached the end of this thread
        console.log("reached end");
        return;
    }
    fbstats.print_download_console("Received " + data.data.length + ' messages');

    $.each(data.data, function(idx, msg){
        console.assert(msg.from != null);
        console.assert(msg.to != null);
        console.assert(msg.message != null);
        cur_message = {};
        cur_message.created_time = msg.created_time;
        cur_message.id = msg.id;
        cur_message.tags = msg.tags.data;
        cur_message.from = msg.from.id;
        cur_message.body = msg.message;
        cur_message.to = $.map(msg.to.data, function(v, k) { return v.id; });
        console.log(cur_message);
        thread.messages.splice(0, 0, cur_message);
    });

    call_delay(function() {
        fbstats.get_thread_messages_helper(thread, idx, len, data);
    });
};


fbstats.get_thread = function (thread, idx, len) {
    thread.messages = [];
    FB.api('/' + thread.id, {
        limit: 500
    }, function (data) {
        // some parts are null
        // or if it's an event.
        // I don't think this is necessary anymore; kept for posterity
        /*
        if (data == null || data.from == null || (data.from != null && data.from.end_time != null)) {
            thread.bad = true; // indicates whether or not this thread should be processed. bad = insufficient information
            fbstats.print_download_console("Thread " + (idx + 1) + " of " + len + ": bad thread encountered... skipping");
            call_delay(function () {
                fbstats.get_all_threads_helper(idx + 1, len);
            }); // "continue"
            return;
        }
        */
        if (fbstats.is_api_timeout_error(data))
        {
            fbstats.print_download_console(API_TIMEOUT_MESSAGE);
            setTimeout(function() {
                fbstats.get_thread(thread, idx, len);
            }, API_TIMEOUT_DELAY);
        }
        else if (data.messages != null)
        {
            fbstats.get_thread_messages(thread, idx, len, data.messages);
        }
        else
        {
            console.log("data.messages was null");
            fbstats.print_download_console("error: data.messages was null");
        }
    });
};


// this function recursively calls itself on the next index after waiting at the tail
// quick-hack for facebook's API limits

fbstats.set_progress_bar = function (num) {
    if (num == 0) {
        $("#progress_bar").hide();
        $("#progress_bar").remove();
        $("#download_progress").append($('<div class="bar" id="progress_bar" style="width: 0%"></div>'));
        return;
    }
    $("#progress_bar").css("width", (num * 100) + "%");
};

fbstats.get_all_threads_helper = function (idx, len) {
    if (idx >= len) {
        return fbstats.data_downloader.done();
    }

    fbstats.set_progress_bar(idx / len);

    call_delay(function () {
        fbstats.get_thread(fbstats.data.threads[idx], idx, len);
    });
};

fbstats.get_all_threads = function () {
    fbstats.print_download_console("Counted " + fbstats.data.threads.length + " total threads");

    fbstats.get_all_threads_helper(0, fbstats.data.threads.length);
};

fbstats.process_thread_list_recurse = function (partial_list) {
    call_delay(function () {
        $.ajax({
            url: partial_list.paging.next,
            dataType: "json",
            success: function (data) {
                if (fbstats.is_api_timeout_error(data)) {
                    fbstats.print_download_console(API_TIMEOUT_MESSAGE);
                    setTimeout(function () {
                        fbstats.process_thread_list_recurse(partial_list);
                    }, API_TIMEOUT_DELAY);
                } else {
                    fbstats.process_thread_list(data);
                }
            }
        });
    });
};

fbstats.process_thread_list = function (partial_list) {
    console.log(partial_list);
    if (partial_list.data.length == 0) return fbstats.get_all_threads(); // no more threads to process
    fbstats.print_download_console("Received block of " + partial_list.data.length + " threads");
    $.each(partial_list.data, function (idx, thread) {
        current_thread = {};
        current_thread.people = [];
        current_thread.id = thread.id;
        current_thread.updated_time = thread.updated_time;
        current_thread.can_reply = thread.can_reply;
        current_thread.is_subscribed = thread.is_subscribed;
        current_thread.link = thread.link;
        current_thread.message_count = thread.message_count;
        current_thread.snippet = thread.snippet;
        current_thread.tags = thread.tags.data;

        thread_people = [];
        $.merge(thread_people, thread.participants ? (thread.participants.data || []) : []);
        $.merge(thread_people, thread.former_participants ? (thread.former_participants.data || []) : []);
        $.merge(thread_people, thread.senders ? (thread.senders.data || []) : []);

        already_pushed = {};
        $.each(thread_people, function (idx, person) {
            if (already_pushed[person.id] == null)
            {
                already_pushed[person.id] = true;
                current_thread.people.push(person.id);
                fbstats.data.people[person.id] = fbstats.data.people[person.id]  || {};
                fbstats.data.people[person.id].name = fbstats.data.people[person.id].name || person.name;
                fbstats.data.people[person.id].email = fbstats.data.people[person.id].email || person.email;
            }
        });
        fbstats.data.threads.push(current_thread);
    });
    fbstats.process_thread_list_recurse(partial_list);
};

fbstats.on_fs_init = function (fs) {
    console.log('successfully opened file system: ' + fs.name);
    fbstats.fs = fs;
};

fbstats.update_nav = function () {
    var tbody = $("#overview_table > tbody");
    fbstats.tid_to_idx = {};
    $.each(fbstats.data.threads, function (idx, thread) {
        fbstats.tid_to_idx[thread.id] = idx;
        if (thread.bad == null) {
            // generate list of names           
            var except_me = [];
            $.each(thread.people, function (idx, id) {
                if (id != fbstats.me.id) {
                    except_me.push(fbstats.data.people[id].name);
                }
            });
            var names_without_me = except_me.join(', ');

            // compute char_count
            var char_count = 0;
            $.each(thread.messages, function (idx, msg) {
                if (msg.body != null) {
                    var len = msg.body.length;
                    char_count += len;
                }
            });

            // Populate side nav bar
            var names = thread.people.map(function (id) {
                return fbstats.data.people[id].name;
            }).join(", ");
            var and_names_without_me = except_me.slice(0, except_me.length).join(', ') + (except_me.length <= 1 ? '' : ' and ' + except_me[except_me.length - 1]);
            var elem = $("<li class='navbar_conversation'><a href='#' id='" + thread.id + "' class='navbar_entry'>" + names_without_me + "</a></li>");
            $("#sidenav").append(elem);

            // populate overview table
            var trow = $("<tr class='overview_table_row' data-id='" + thread.id + "'>");
            var last_mod = new Date(thread.updated_time);
            trow.append($("<td>" + last_mod.toLocaleString() + "</td>"));
            trow.append($("<td>" + names_without_me + "</td>"));
            trow.append($("<td>" + thread.messages.length + "</td>"));
            trow.append($("<td>" + char_count + "</td>"));
            tbody.append(trow);
        }
    });
    fbstats.regen_overview_table();
    $.unblockUI();
}

fbstats.regen_overview_table = function () {
    return $('#overview_table').dataTable({
        bDestroy: true,
        sPaginationType: "bootstrap",
        iDisplayLength: 25,
        oLanguage: {
            sLengthMenu: "_MENU_ threads per page"
        },
        bAutoWidth: false,
        aaSorting: [
            [0, "desc"]
        ],
        aLengthMenu: [
            [10, 25, 50, 100, -1],
            [10, 25, 50, 100, 'All']
        ],
        aoColumns: [{
            sType: "date",
            bSortable: true,
            sWidth: "20%"
        }, {
            bSortable: true,
            sWidth: "50%"
        }, {
            sWidth: "15%",
            bSortable: true,
        }, {
            sWidth: "15%",
            bSortable: true,
        }]
    });
};

fbstats.update_from_cache = function (success) {
    fbstats.update_alert('error', '<strong>Error!</strong> Message data has not been collected yet. Go to Settings to collect data.');
    $(".navbar_conversation").remove();
    $("#overview_table > tbody > tr").remove();
    $(".main_conversation").remove();
    fbstats.regen_overview_table().fnClearTable();
    fbstats.did_gen_thread = {};
    fbstats.did_gen_word_cloud = {};
    fbstats.did_gen_active_graph = {};
    fbstats.message_count_per_day = {};
    fbstats.message_count_per_day_per_person = {};
    fbstats.character_count_per_day = {};
    fbstats.character_count_per_day_per_person = {};
    fbstats.person_msg_count = {};
    fbstats.person_char_count = {};
    fbstats.did_gen_trends = {};
    fbstats.read_file(fbstats.me.id, function (a, b, file_entry) {
        try {
            var str = b.result;
            var obj = JSON.parse(str);
            if (obj != null) {
                if (obj.timestamp != null && obj.threads != null && obj.people != null) {
                    var data_date = new Date(obj.timestamp);
                    fbstats.update_alert('success', 'Using data last updated on <strong>' + data_date.toString() + '</strong>');
                    var e = $("#save_data_local");
                    e.attr("download", fbstats.me.first_name + fbstats.me.last_name + "_" + fbstats.me.id + ".txt");
                    e.attr("href", file_entry.toURL());
                    fbstats.data = obj;
                    // fbstats.update_statistics();
                    fbstats.update_nav();
                    if (success != null) success();
                }
            }
        } catch (err) {
            console.log(err.message);
        }
    }, function (err) {
        $.unblockUI();
        if (success != null) success();
    });
};


/*
 * Thanks to http://static.mrfeinberg.com/bv_ch03.pdf for the filters/algorithm/idea
 */
var stopWords = /^(i|me|my|myself|we|us|our|ours|ourselves|you|your|yours|yourself|yourselves|he|him|his|himself|she|her|hers|herself|it|its|itself|they|them|their|theirs|themselves|what|which|who|whom|whose|this|that|these|those|am|is|are|was|were|be|been|being|have|has|had|having|do|does|did|doing|will|would|should|can|could|ought|i'm|you're|he's|she's|it's|we're|they're|i've|you've|we've|they've|i'd|you'd|he'd|she'd|we'd|they'd|i'll|you'll|he'll|she'll|we'll|they'll|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|doesn't|don't|didn't|won't|wouldn't|shan't|shouldn't|can't|cannot|couldn't|mustn't|let's|that's|who's|what's|here's|there's|when's|where's|why's|how's|a|an|the|and|but|if|or|because|as|until|while|of|at|by|for|with|about|against|between|into|through|during|before|after|above|below|to|from|up|upon|down|in|out|on|off|over|under|again|further|then|once|here|there|when|where|why|how|all|any|both|each|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|say|says|said|shall)$/,
    punctuation = /[!"&()*+,-\.\/:;<=>?\[\\\]^`\{|\}~]+/g,
    wordSeparators = /[\s\u3031-\u3035\u309b\u309c\u30a0\u30fc\uff70]+/g,
    discard = /^(@|https?:)/,
    htmlTags = /(<[^>]*?>|<script.*?<\/script>|<style.*?<\/style>|<head.*?><\/head>)/g;

fbstats.get_words_from_string = function (str) {
    return str.split(wordSeparators).map(function (val) {
        if (discard.test(val)) return null;
        val = val.replace(punctuation, '');
        if (stopWords.test(val.toLowerCase())) return null;
        if (is_num(val)) return null; // todo see if filtering numbers is good
        return val;
    }).filter(function (val) {
        return val;
    });
}

fbstats.generate_active_graph = function(tid, step_interval_minutes, name) {
    buckets = {};
    var thread = fbstats.data.threads[fbstats.tid_to_idx[tid]];
    $.each(thread.messages, function(idx, msg){
        var ts = new Date(msg.timestamp);
        var minutes = 60 * ts.getHours() + ts.getMinutes();
        var bucketidx = ~~(minutes / step_interval_minutes);
        buckets[msg.from] = buckets[msg.from] || {};
        buckets[msg.from][bucketidx] = (buckets[msg.from][bucketidx] || 0) + 1;
    });
    var bucket_count = ~~Math.ceil(24 * 60 / step_interval_minutes); // 24 hours

    var data = [];
    var step_interval_ms = step_interval_minutes * 60000;

    var today_date = Date.UTC(2013, 5, 2); // any date is fine

    $.each(thread.people, function(idx, person){
        var curdata = {
            name: fbstats.data.people[person].name,
            pointInterval: step_interval_ms,
            pointStart: today_date
        };
        if (buckets[person] != null)
        {
            for (var i = 0; i < bucket_count; i++) 
                buckets[person][i] = buckets[person][i] || 0;
            curdata.data = $.map(buckets[person], function(v, k) { return v; });
            data.push(curdata);
        }
    });

    var fmt_time = function(d) {
        var dh = (d.getUTCHours() % 12) || 12;
        return (dh + ':' + (d.getUTCMinutes() < 10 ? '0' : '') + d.getUTCMinutes() + (d.getUTCHours() >= 12 ? 'pm' : 'am'));
    };

    $('#' + tid + "_activechart").highcharts({
        chart: {
            type: 'column',
            zoomType: 'x'
        },
        title: {
            text: 'Most active time per ' + name
        },
        subtitle: {
            text: "Zoom by clicking and dragging inside the graph."
        },
        credits: {enabled: false},
        xAxis: {
            title: {text: 'Time'},
            type: 'datetime',
            dateTimeLabelFormats: { // don't display the dummy year
                day : '%l:%M %p',
                hour : '%l:%M %p',
                minute : '%l:%M %p'
            },
            tickInterval: step_interval_ms,
            labels: {
                rotation: -90,
                align: 'right',
                style: {
                    fontSize: '10px',
                }
            }
        },
        yAxis: {
            min: 0,
            title: {
                text: 'Messages'
            },
            stackLabels: {
                enabled: true,
                style: {
                    fontWeight: 'bold',
                    color: (Highcharts.theme && Highcharts.theme.textColor) || 'gray'
                }
            }
        },
        tooltip: {
            formatter: function() {
                var d = new Date(this.x);
                var nd = new Date(d.getTime() + step_interval_ms);
                console.log(this.x);
                return '<b>'+ fmt_time(d) + ' to ' + fmt_time(nd) + '</b><br/>'+
                    this.series.name +': '+ this.y +'<br/>'+
                    'Total: '+ this.point.stackTotal;
            }
        },
        plotOptions: {
            column: {
                stacking: 'normal',
                dataLabels: {
                    enabled: true,
                    color: (Highcharts.theme && Highcharts.theme.dataLabelsColor) || 'white'
                },
            }
        },
        series: data
    });

};

fbstats.generate_word_cloud = function (tid, opts) {
    var str = "";
    var elem_id = '#x' + tid + '_cloud';
    var thread = fbstats.data.threads[fbstats.tid_to_idx[tid]];
    $.each(thread.messages, function (idx, val) {
        if (val.body) str += val.body + ' ';
    });
    if (opts.downcase) {
        str = str.toLowerCase(); // todo see if forcing lowercase is good
    }
    tags = {};
    $.each(fbstats.get_words_from_string(str), function (idx, word) {
        tags[word] = (tags[word] || 0) + 1;
    });
    tags = d3.entries(tags).sort(function (a, b) {
        return b.value - a.value;
    });
    console.log(tags);

    tags = tags.slice(0, Math.min(tags.length, opts.max_words));

    $.each(tags, function(idx, val){
        tags[idx].idx = idx;
    });

    var len = tags.length;

    var fill = d3.scale.category20c();

    var svg = d3.select(elem_id).append('svg').attr('width', opts.w).attr('height', opts.h);
    var background = svg.append('g');
    var vis = svg.append('g').attr('transform', 'translate(' + [opts.w >> 1, opts.h >> 1] + ')');

    var scale;

    var fontSize = d3.scale.linear().range([10, 100]);
    fontSize.domain([+tags[tags.length - 1].value || 1, +tags[0].value]);
    console.log([+tags[tags.length - 1].value || 1, +tags[0].value]);
    var progress = function () {
        console.log('progress');
    };

    var draw = function (data, bounds) {
        // console.log(data);
        scale = bounds ? Math.min(
            opts.w / Math.abs(bounds[1].x - opts.w / 2),
            opts.w / Math.abs(bounds[0].x - opts.w / 2),
            opts.h / Math.abs(bounds[1].y - opts.h / 2),
            opts.h / Math.abs(bounds[0].y - opts.h / 2)) / 2 : 1;
        words = data;
        var text = vis.selectAll("text")
            .data(words, function (d) {
                return d.text.toLowerCase();
            });
        text.transition()
            .duration(1000)
            .attr("transform", function (d) {
                return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
            })
            .style("font-size", function (d) {
                return d.size + "px";
            });
        text.enter().append("text")
            .attr("text-anchor", "middle")
            .attr("transform", function (d) {
                return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
            })
            .style("font-size", function (d) {
                return d.size + "px";
            })
            .on("click", function (d) {
                load(d.text);
            })
            .style("opacity", 1e-6)
            .transition()
            .duration(1000)
            .style("opacity", 1);
        text.style("font-family", function (d) {
            return d.font;
        })
            .style("fill", function (d) {
                return fill(d.text.toLowerCase());
            })
            .text(function (d) {
                return d.text;
            });
        var exitGroup = background.append("g")
            .attr("transform", vis.attr("transform"));
        var exitGroupNode = exitGroup.node();
        text.exit().each(function () {
            exitGroupNode.appendChild(this);
        });
        exitGroup.transition()
            .duration(1000)
            .style("opacity", 1e-6)
            .remove();
        vis.transition()
            .delay(1000)
            .duration(750)
            .attr("transform", "translate(" + [opts.w >> 1, opts.h >> 1] + ")scale(" + scale + ")");
    };

    var get_rotation = function(d) {
        // top 5% of words have a higher chance of appearing horizontal
        if (Math.random() <= ((d.idx / len) <= 0.05 ? 0.85 : 0.5)) return 0;
        else return -90;
    };

    var layout = d3.layout.cloud()
        .timeInterval(10)
        .size([opts.w, opts.h])
        .fontSize(function (d) {
            return fontSize(+d.value);
        })
        .text(function (d) {
            return d.key;
        })
        .on('word', progress)
        .on('end', draw)
        .font(opts.font_face)
        .spiral('archimedean')
        .rotate(get_rotation)
        .words(tags)
        .start();
}

fbstats.generate_trends = function (tid, typeid) {
    typeid = typeid || "message";
    var thread = fbstats.data.threads[fbstats.tid_to_idx[tid]];
    var trends = $('#' + tid + "_trends");

    var trend_chart = $('#' + tid + '_trendchart');

    var lambda_recreate_chart = function (data_series, t, yax) {
        trend_chart.highcharts({
            chart: {
                zoomType: 'x',
                type: 'line',
                marginTop: 80
            },
            credits: {
                enabled: false
            },
            title: {
                text: t
            },
            subtitle: {
                text: 'Click and drag in the plot to zoom in.<br/>Click the data sets in the legend to toggle data visibility.'
            },
            xAxis: {
                type: 'datetime',
                maxZoom: 24 * 3600000, // 1 day
            },
            yAxis: yax,
            series: data_series,
            plotOptions: {
                line: {
                    lineWidth: 2,
                    marker: {
                        enabled: false
                    }
                }
            }
        });
    };

    var first_date = new Date(thread.messages[0].timestamp);
    first_date.setHours(0, 0, 0, 0);
    var rfirst_date = new Date(thread.messages[0].timestamp);
    rfirst_date.setHours(0, 0, 0, 0);

    var total_msg_chart_data = {
        name: "Total Messages",
        pointInterval: 24 * 3600 * 1000,
        pointStart: first_date.getTime(),
        yAxis: "MSG_AXIS",
        data: []
    };
    var avg_msg_per_day = {
        name: "Avg. messages per day",
        pointInterval: 24 * 3600 * 1000,
        pointStart: first_date.getTime(),
        yAxis: "MSG_AXIS",
        data: []
    };
    var total_char_chart_data = {
        name: "Total Characters",
        pointInterval: 24 * 3600 * 1000,
        pointStart: first_date.getTime(),
        yAxis: "CHAR_AXIS",
        data: []
    };
    var avg_char_per_day = {
        name: "Avg. characters per day",
        pointInterval: 24 * 3600 * 1000,
        pointStart: first_date.getTime(),
        yAxis: "CHAR_AXIS",
        data: []
    };
    var all_message_data = [];
    var all_character_data = [];

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var cur_message_count = 0;
    var cur_character_count = 0;
    var elapsed_days = 0;
    while (first_date <= today) {
        var idx = [first_date.getFullYear(), first_date.getMonth() + 1, first_date.getDate()];
        var cnt = fbstats.message_count_per_day[tid][idx] || 0;
        var charcnt = fbstats.character_count_per_day[tid][idx] || 0;
        cur_character_count += charcnt;
        cur_message_count += cnt;
        total_msg_chart_data.data.push(cnt);
        total_char_chart_data.data.push(cnt);
        first_date.setDate(first_date.getDate() + 1);
        elapsed_days++;
        avg_msg_per_day.data.push(cur_message_count / elapsed_days);
        avg_char_per_day.data.push(cur_character_count / elapsed_days);
    }
    all_message_data.push(total_msg_chart_data);
    all_message_data.push(avg_msg_per_day);
    all_character_data.push(total_char_chart_data);
    all_character_data.push(avg_char_per_day);
    $.each(thread.people, function (idx, id) {
        if (fbstats.person_msg_count[tid][id] > 0) {
            first_date = new Date(thread.messages[0].timestamp);
            first_date.setHours(0, 0, 0, 0);
            var temp = {
                name: "Msgs from " + fbstats.data.people[id].name,
                pointInterval: 24 * 3600 * 1000,
                pointStart: first_date.getTime(),
                yAxis: "MSG_AXIS",
                data: []
            };
            var temp2 = {
                name: "Chars from " + fbstats.data.people[id].name,
                pointInterval: 24 * 3600 * 1000,
                pointStart: first_date.getTime(),
                yAxis: "CHAR_AXIS",
                data: []
            };
            while (first_date <= today) {
                var idx = [first_date.getFullYear(), first_date.getMonth() + 1, first_date.getDate()];
                temp.data.push(fbstats.message_count_per_day_per_person[tid][idx] == null ? 0 : (fbstats.message_count_per_day_per_person[tid][idx][id] || 0));
                temp2.data.push(fbstats.character_count_per_day_per_person[tid][idx] == null ? 0 : (fbstats.character_count_per_day_per_person[tid][idx][id] || 0));
                first_date.setDate(first_date.getDate() + 1);
            }
            all_message_data.push(temp);
            all_character_data.push(temp2);
        }
    });
    var MSG_AXIS = {
        title: {
            text: "Messages per day"
        },
        startOnTick: false,
        id: "MSG_AXIS"
    };
    var CHAR_AXIS = {
        title: {
            text: "Characters per day"
        },
        startOnTick: false,
        id: "CHAR_AXIS",
        opposite: (typeid == 'both')
    };
    console.log([MSG_AXIS, CHAR_AXIS]);
    if (typeid == 'both') {
        lambda_recreate_chart($.merge(all_message_data, all_character_data), "Messages and Characters", [MSG_AXIS, CHAR_AXIS]);
    } else if (typeid == 'message') {
        lambda_recreate_chart(all_message_data, "Messages", MSG_AXIS);
    } else if (typeid == 'character') {
        lambda_recreate_chart(all_character_data, "Characters", CHAR_AXIS);
    }
}

fbstats.gen_thread = function (tid) {
    var thread = fbstats.data.threads[fbstats.tid_to_idx[tid]];
    if (thread.bad == null) {
        // compute some quick stats

        var mtable = "<table class='table table-striped table-hover'><thead>" +
            "<tr><th>MsgID</th><th>From</th><th>Time sent</th><th>Message text</th></tr></thead><tbody>";
        var char_count = 0;
        fbstats.person_char_count[tid] = {};
        fbstats.message_count_per_day[tid] = {};
        fbstats.message_count_per_day_per_person[tid] = {};
        fbstats.character_count_per_day[tid] = {};
        fbstats.character_count_per_day_per_person[tid] = {};
        fbstats.person_msg_count[tid] = {};
        $.each(thread.messages, function (idx, msg) {
            try {
                mtable += "<tr><td>" + msg.id + "</td><td>" + fbstats.data.people[msg.from].name + "</td><td>" +
                    (new Date(msg.timestamp)).toLocaleString() + "</td><td>" + (msg.body == null ? "" : msg.body) + "</td></tr>";
            } catch (err) {
                console.log(err.message);
            }
            var dd = new Date(msg.timestamp);
            var ds = [dd.getFullYear(), dd.getMonth() + 1, dd.getDate()];
            fbstats.message_count_per_day[tid][ds] = fbstats.message_count_per_day[tid][ds] || 0;
            fbstats.message_count_per_day[tid][ds]++;
            fbstats.message_count_per_day_per_person[tid][ds] = fbstats.message_count_per_day_per_person[tid][ds] || {};
            fbstats.message_count_per_day_per_person[tid][ds][msg.from] = fbstats.message_count_per_day_per_person[tid][ds][msg.from] || 0;
            fbstats.message_count_per_day_per_person[tid][ds][msg.from]++;
            fbstats.person_msg_count[tid][msg.from] = fbstats.person_msg_count[tid][msg.from] == null ? 1 : fbstats.person_msg_count[tid][msg.from] + 1;
            if (msg.body != null) {
                var len = msg.body.length;
                char_count += len;
                fbstats.person_char_count[tid][msg.from] = fbstats.person_char_count[tid][msg.from] == null ? len : fbstats.person_char_count[tid][msg.from] +
                    len;
                fbstats.character_count_per_day[tid][ds] = fbstats.character_count_per_day[tid][ds] || 0;
                fbstats.character_count_per_day[tid][ds] += len;
                fbstats.character_count_per_day_per_person[tid][ds] = fbstats.character_count_per_day_per_person[tid][ds] || {};
                fbstats.character_count_per_day_per_person[tid][ds][msg.from] = fbstats.character_count_per_day_per_person[tid][ds][msg.from] || 0;
                fbstats.character_count_per_day_per_person[tid][ds][msg.from] += len;
            } else {
                console.log("null message");
            }
        });
        mtable += "</tbody>";

        var except_me = [];
        $.each(thread.people, function (idx, id) {
            if (id != fbstats.me.id) {
                except_me.push(fbstats.data.people[id].name);
            }
        });
        var names_without_me = except_me.join(', ');
        // Populate side nav bar
        var names = thread.people.map(function (id) {
            return fbstats.data.people[id].name;
        }).join(", ");
        var and_names_without_me = except_me.slice(0, except_me.length).join(', ') + (except_me.length <= 1 ? '' : ' and ' + except_me[except_me.length - 1]);
        var mainelem = $("<div id='" + thread.id + "_content' class='main_conversation'><h3>Conversation with " + and_names_without_me + "</h3><hr></div>");

        var last_mod = new Date(thread.updated_time);

        // populate tabbing system
        var tabs = $("<ul class='nav nav-tabs'>");
        tabs.append($("<li class='active'><a data-toggle='tab' href='#" + thread.id + "_home'>Home</a></li>"));
        tabs.append($("<li><a class='thread_tab' data-tid='" + thread.id + "' data-toggle='tab' href='#" + thread.id + "_mlist'>Message list</a></li>"));
        tabs.append($("<li><a class='thread_tab' data-tid='" + thread.id + "' data-tab-type='trends' data-toggle='tab' href='#" + thread.id + "_trends'>Trends over time</a></li>"));
        tabs.append($("<li><a class='thread_tab' data-tid='" + thread.id + "' data-tab-type='cloud' data-toggle='tab' href='#x" + thread.id + "_cloud'>Word cloud</a></li>"));
        tabs.append($("<li><a class='thread_tab' data-tid='" + thread.id + "' data-tab-type='active' data-toggle='tab' href='#" + thread.id + "_active'>Most active time</a></li>"));
        mainelem.append(tabs);

        // populate tab content
        var tab_content = $("<div class='tab-content'>");
        var home = $('<div class="tab-pane active" id="' + thread.id + '_home"></div>');
        home.append("<h4>Aggregate statistics</h4>");
        var table1 = $("<table class='table table-striped table-hover'><thead>" +
            "<tr><th>Last action</th><th>Total messages sent</th><th>Total characters sent</th></thead>" +
            "<tbody><tr><td>" + last_mod.toLocaleString() + "</td><td>" + thread.messages.length + "</td><td>" +
            char_count + "</td></tr></tbody>" +
            "</table>");
        home.append(table1);
        home.append($("<br><h4>Individual statistics</h4>"));
        var table2html = "<table class='table table-striped table-hover'><thead>" +
            "<tr><th>Name</th><th>Messages sent</th><th>Message %</th><th>Characters sent</th><th>" +
            "Character %</th><th>Avg. characters per message</th></tr></thead><tbody>";
        $.each(thread.people, function (idx, id) {
            table2html += "<tr><td>" + fbstats.data.people[id].name + "</td><td>" + (fbstats.person_msg_count[tid][id] || 0) + "</td><td>" + round_tenth(100 * (fbstats.person_msg_count[tid][id] || 0) / thread.messages.length) + "</td><td>" +
                (fbstats.person_char_count[tid][id] || 0) + "</td><td>" + round_tenth(100 * (fbstats.person_char_count[tid][id] || 0) / char_count) + "</td>" +
                "<td>" + (fbstats.person_msg_count[tid][id] == null ? 0 : round_tenth(fbstats.person_char_count[tid][id] / fbstats.person_msg_count[tid][id])) + "</td></tr>";
        });
        table2html += "</tbody>";
        var table2 = $(table2html);

        home.append(table2);
        var msg_pichart = $("<div class='chart300' id='" + thread.id + "_msgpichart'>");
        var char_pichart = $("<div class='chart300' id='" + thread.id + "_charpichart'>");
        home.append(msg_pichart);
        home.append(char_pichart);
        console.log(fbstats.person_msg_count[tid]);
        msg_pichart.highcharts({
            title: {
                text: 'Message sending distribution'
            },
            tooltip: {
                pointFormat: "{series.name}: <b>{point.percentage}</b>",
                percentageDecimals: 1
            },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: "pointer",
                    dataLabels: {
                        enabled: false
                    },
                    showInLegend: true
                }
            },
            credits: {
                enabled: false
            },
            series: [{
                type: 'pie',
                name: 'Message %',
                data: $.map(fbstats.person_msg_count[tid], function (val, key) {
                    return [[fbstats.data.people[key].name, val]];
                })
            }]
        });
        char_pichart.highcharts({
            title: {
                text: 'Character sending distribution'
            },
            tooltip: {
                pointFormat: "{series.name}: <b>{point.percentage}</b>",
                percentageDecimals: 1
            },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: "pointer",
                    dataLabels: {
                        enabled: false
                    },
                    showInLegend: true
                }
            },
            credits: {
                enabled: false
            },
            series: [{
                type: 'pie',
                name: 'Character %',
                data: $.map(fbstats.person_char_count[tid], function (val, key) {
                    return [[fbstats.data.people[key].name, val]];
                })
            }]
        });
        tab_content.append(home);

        var mlist = $('<div class="tab-pane" id="' + thread.id + '_mlist"></div>');
        mlist.append("<h4>Messages</h4>");
        var emtable = $(mtable);

        mlist.append(emtable);

        tab_content.append(mlist);

        // trends tab -> we delay the generation until the tab is clicked
        // so the javascript can calculate the width/height after it becomes visible
        var trends = $('<div class="tab-pane" id="' + thread.id + '_trends"></div>');
        var metric_radio = $("<div class='btn-group' data-toggle='buttons-radio' style='display:block;'>" +
            "<button data-tid='" + thread.id + "' data-metric='message' type='button' class='metric_button active btn' id='" + thread.id + "mcbtn'>Message count only</button>" +
            "<button data-tid='" + thread.id + "' data-metric='character' type='button' class='metric_button btn' id='" + thread.id + "ccbtn'>Character count only</button>" +
            "<button data-tid='" + thread.id + "' data-metric='both' type='button' class='metric_button btn' id='" + thread.id + "mcbtn'>Msg. and char. count</button></div>");
        $(metric_radio).button();
        trends.append(metric_radio);
        var trend_chart = $("<div class='chartfull' id='" + thread.id + "_trendchart'>");
        trends.append(trend_chart);
        tab_content.append(trends);

        var cloud_tab = $('<div class="tab-pane" id="x' + thread.id + '_cloud"></div>');
        tab_content.append(cloud_tab);

        var active_tab = $('<div class="tab-pane" id="' + thread.id + '_active"></div>');

        var active_select_id = tid + '_active_select';

        var active_form = $('<form class="form"><label for="'+active_select_id+'">Time step: </label><select class="active-select" data-tid="' + thread.id + '" id="' + 
            active_select_id + '" name="' + active_select_id + '"><option value="15">15 min</option><option value="30">30 min</option><option value="60" selected="selected">1 hr</option><option value="120">2 hr</option>' +
            '<option value="360">6 hr</option><option value="720">12 hr</option></select></form>');
        active_tab.append(active_form);
        var active_chart = $("<div class='chartfull' id='" + thread.id + "_activechart'>");
        active_tab.append(active_chart);
        tab_content.append(active_tab);

        mainelem.append(tab_content);

        emtable.dataTable({
            bDestroy: true,
            aaSorting: [
                [0, 'asc']
            ],
            sPaginationType: "bootstrap",
            iDisplayLength: 100,
            aLengthMenu: [
                [10, 25, 50, 100, -1],
                [10, 25, 50, 100, 'All']
            ],
            oLanguage: {
                sLengthMenu: "_MENU_ messages per page"
            },
            bAutoWidth: false,
            aoColumns: [{
                bSortable: true,
                sWidth: "5%"
            }, {
                sWidth: "15%",
                bSortable: true,
            }, {
                sType: "date",
                bSortable: true,
                sWidth: "15%"
            }, {
                bSortable: true,
            }]
        });

        table2.dataTable({
            bDestroy: true,
            aLengthMenu: [
                [10, 25, 50, 100, -1],
                [10, 25, 50, 100, 'All']
            ],
            aaSorting: [
                [1, "desc"]
            ],
            sPaginationType: "bootstrap",
            iDisplayLength: 10,
            oLanguage: {
                sLengthMenu: "_MENU_ people per page"
            },
        });

        // finally, update the page
        $("#page_content").append(mainelem);
    }
}

fbstats.sim_click = function (obj) {
    $(".navbar_entry").each(function (idx, obj) {
        $(obj).parent().removeClass("active");
    });
    if ($(obj).parent().hasClass("navbar_conversation")) {
        var id = $(obj).attr('id');
        if (fbstats.did_gen_thread[id] == null) {
            fbstats.gen_thread(id);
            fbstats.did_gen_thread[id] = true;
        }
    }
    $(obj).parent().addClass("active");
    fbstats.nav_to($(obj).attr("id"));
};

fbstats.create_file = function (name, success) {
    fbstats.fs.root.getFile(name, {
        create: true,
        exclusive: true
    }, function (file_entry) {
        console.log("created file " + name);
        if (success != null) success(file_entry);
    }, fbstats.fs_error_handler);
};

fbstats.write_file = function (name, text, success) {
    fbstats.fs.root.getFile(name, {
        create: false
    }, function (file_entry) {
        file_entry.createWriter(function (file_writer) {
            file_writer.write(new Blob([text], {
                type: "text/plain"
            }));
            if (success != null) success(file_writer);
        }, fbstats.fs_error_handler);
    }, fbstats.fs_error_handler);
};

fbstats.read_file = function (name, success, err) {
    fbstats.fs.root.getFile(name, {
        create: false
    }, function (file_entry) {
        file_entry.file(function (file) {
            var reader = new FileReader();
            reader.onloadend = function (e) {
                if (success != null) success(e, this, file_entry);
            };
            reader.readAsText(file);
        }, err == null ? fbstats.fs_error_handler : err);
    }, err == null ? fbstats.fs_error_handler : err);
};

fbstats.delete_file = function (name, success, error_handler) {
    fbstats.fs.root.getFile(name, {
        create: false
    }, function (file_entry) {
        file_entry.remove(function () {
            console.log("removed file " + name);
            success(file_entry);
        }, error_handler);
    }, error_handler);
};

fbstats.fs_error_handler = function (e) {
    var msg = '';
    switch (e.code) {
    case FileError.QUOTA_EXCEEDED_ERR:
        msg = 'QUOTA_EXCEEDED_ERR';
        break;
    case FileError.NOT_FOUND_ERR:
        msg = 'NOT_FOUND_ERR';
        break;
    case FileError.SECURITY_ERR:
        msg = 'SECURITY_ERR';
        break;
    case FileError.INVALID_MODIFICATION_ERR:
        msg = 'INVALID_MODIFICATION_ERR';
        break;
    case FileError.INVALID_STATE_ERR:
        msg = 'INVALID_STATE_ERR';
        break;
    default:
        msg = 'Unknown Error';
        break;
    }
    console.log('error: ' + msg);
};

fbstats.print_download_console = function (text) {
    var e = $("#debug_console_download");
    var cur = e.html();
    e.html("[" + (new Date()).toLocaleString() + "] " + text + "\n" + cur);
};

fbstats.retrieve_btn_click = function () {
    // $("#last_update_settings").html((new Date()).toString());
    fbstats.set_progress_bar(0);
    $("#retrieve_btn").button('loading');
    // initialize data object
    fbstats.data = {};
    fbstats.data.threads = [];
    fbstats.data.people = {};

    fbstats._tmpcnt = {};

    fbstats.print_download_console("Started downloading initial thread list");

    FB.api('/me/threads', {
        limit: 100
    }, function (inbox) {
        if (fbstats.is_api_timeout_error(inbox)) {
            fbstats.print_download_console(API_TIMEOUT_MESSAGE);
            setTimeout(fbstats.retrieve_btn_click, API_TIMEOUT_DELAY);
        } else {
            call_delay(fbstats.process_thread_list(inbox));
        }
    });
};

fbstats.blockUI = function () {
    $.blockUI({
        message: "<h4>Initializing, loading, and parsing data. Please wait...</h4>"
    });
}

fbstats.init = function () {
    window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    if (!FileReader || !window.requestFileSystem || !Modernizr.localstorage) {
        fbstats.update_alert('error alert-block',
            "<strong>Error: Browser not supported!</strong> This browser does not support the HTML5 File APIs and cannot continue. Google Chrome is the only browser with a working implementation of this API.");
        return;
    }
    fbstats.blockUI();
    window.fbAsyncInit = function () {
        FB.init({
            appId: APP_ID,
            status: true,
            xfbml: false
        });
        console.log("facebook api initialized.");

        FB.getLoginStatus(function (resp) {
            if (resp.status == "connected") {
                FB.api('/me', function (me) {
                    fbstats.me = me;
                    $("#uname").html(me.name);
                    $("#user_dropdown").show();
                    fbstats.finish_auth();
                });
            } else {
                $("#login_facebook").show();
                $.unblockUI();
            }
        });
    };
    jQuery.event.props.push("dataTransfer");

    $("#login_with_facebook").click(function () {
        FB.login(function (response) {
            console.log(response);
            if (response.authResponse) {
                FB.api('/me', function (me) {
                    fbstats.me = me;
                    $("#uname").html(me.name);
                    $("#login_facebook").hide();
                    $("#user_dropdown").show();
                    fbstats.finish_auth();
                });
            }
        }, {
            scope: "read_mailbox"
        });
    });

    $("#clear_cache_btn").click(function () {
        bootbox.confirm("Are you sure you want to clear all of your data from your local cache? (you will have to redownload all of it)", function (res) {
            if (res == true) {
                var lambda = function (arg) {
                    fbstats.set_progress_bar(0);
                    fbstats.print_download_console("Cleared cached data");
                    fbstats.blockUI();
                    fbstats.update_from_cache();
                    fbstats.set_progress_bar(1);
                };
                fbstats.delete_file(fbstats.me.id, lambda, lambda);
            }
        });
    });

    $("#retrieve_btn").click(function () {
        fbstats.retrieve_btn_click();
    });

    $("#facebook_logout").click(function () {
        FB.logout(function (response) {
            location.reload(true);
        });
    });

    $(document).on('click', '.navbar_entry', function (evt) {
        var obj = evt.currentTarget;
        evt.stopPropagation();
        evt.preventDefault();
        fbstats.sim_click(obj);
    });

    // initialize file system stuff
    window.webkitStorageInfo.requestQuota(window.PERSISTENT, fbstats.fs_bytes, function (grantedBytes) {
        console.log("granted " + grantedBytes + " bytes of storage");
        window.requestFileSystem(window.PERSISTENT, grantedBytes, fbstats.on_fs_init, fbstats.fs_error_handler);
    });

    // drag and drop box
    var db = $("#dropbox");
    db.on("drop", function (evt) {
        evt.stopPropagation();
        evt.preventDefault();
        db.removeClass("highlight_border");
        var fn = evt.dataTransfer.files[0].name;
        var ff = evt.dataTransfer.files[0];
        bootbox.confirm("Would you like to load data from " + fn + "?", function (response) {
            if (!response) {
                fbstats.set_progress_bar(0);
                return;
            }
            var reader = new FileReader();
            reader.onload = function (e) {
                fbstats.set_progress_bar(0);
                try {
                    if (e.target.readyState != 2) return;
                    if (e.target.error) {
                        throw error.toString();
                    }
                    var txt = e.target.result;
                    var obj = JSON.parse(txt);

                    if (obj == null || obj.timestamp == null || obj.threads == null || obj.people == null) {
                        throw "invalid file format";
                    } else {
                        fbstats.set_progress_bar(1);
                        var lambda = function (arg) {
                            // should execute regardless of deletion status
                            fbstats.create_file(fbstats.me.id, function (file_entry) {
                                file_entry.createWriter(function (file_writer) {
                                    file_writer.write(new Blob([txt], {
                                        type: "text/plain"
                                    }));
                                    console.log("wrote data to file");
                                    fbstats.blockUI();
                                    fbstats.update_from_cache();
                                    fbstats.print_download_console("Loaded data from file " + fn);
                                }, fbstats.fs_error_handler);
                            });
                        };

                        fbstats.delete_file(fbstats.me.id, lambda, lambda);
                    }
                } catch (err) {
                    bootbox.alert("An error occured while reading the file: " + err.toString());
                }
            };
            reader.readAsText(ff);
        });
    }).on("dragenter dragleave dragover", function (evt) {
        evt.stopPropagation();
        evt.preventDefault();
        if (evt.type == "dragenter") {
            db.addClass("highlight_border");
        } else if (evt.type == "dragleave") {
            db.removeClass("highlight_border");
        }
    });

    $(window).hashchange(function () {
        fbstats.sim_click($('#' + location.hash.slice(1)));
    });

    $("#delta_update").click(function () {
        $(this).button('loading');
        call_delay(function () {
            $("#delta_update").button('reset');
        });
    });

    $(document).on('click', '.thread_tab', function (evt) {
        var tgt = $(evt.target);
        var tab_type = tgt.attr('data-tab-type');
        var id = tgt.attr('data-tid');
        if (tab_type == 'trends') {
            if (fbstats.did_gen_trends[id] == null) {
                fbstats.generate_trends(id);
                fbstats.did_gen_trends[id] = true;
            }
        } else if (tab_type == 'cloud') {
            if (fbstats.did_gen_word_cloud[id] == null) {
                fbstats.generate_word_cloud(id, {
                    downcase: true,
                    w: 960,
                    h: 600,
                    max_words: 150,
                    font_face: 'Coolvetica Rg'
                });
                fbstats.did_gen_word_cloud[id] = true;
            }
        } else if (tab_type == 'active')
        {
            if (fbstats.did_gen_active_graph[id] == null)
            {
                fbstats.generate_active_graph(id, 60, '1 hr'); // default bucket size: 1 hour
                fbstats.did_gen_active_graph[id] = true;
            }
        }
    });

    $(document).on('click', '.active-select', function(evt){
        var tgt = $(evt.target);
        var id = tgt.attr('data-tid');
        var ts = tgt.find('option:selected').html();
        var tsmin = tgt.val();
        fbstats.generate_active_graph(id, tsmin, ts); // default bucket size: 1 hour
    });

    $(document).on('click', '.overview_table_row', function (evt) {
        var id = $(evt.target).parent().attr('data-id');
        if (id == null) return false;
        fbstats.sim_click($('#' + id));
    });

    $(document).on('click', '.metric_button', function (evt) {
        var tgt = $(evt.target);
        var metric = tgt.attr('data-metric');
        var id = tgt.attr('data-tid');
        fbstats.generate_trends(id, metric);
    });

    $(document).on('click', '#about_btn', function(evt){
        bootbox.alert("<h2>fbstats</h2><p>Copyright Stanley Cen 2013</p><p>Released under the MIT license</p><p><a href='https://github.com/scen/fbstats'>GitHub repository</a></p><p><a href='http://stanleycen.com/blog/facebook-messaging-analytics'>Project page</a></p>");
        evt.preventDefault();
        evt.stopPropagation();
    });

    setTimeout(function () {
        if (location.hash) {
            window.scrollTo(0, 0);
        }
    }, 1);

    (function (d, s, id) {
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) {
            return;
        }
        js = d.createElement(s);
        js.id = id;
        js.src = "http://connect.facebook.net/en_US/all.js";
        fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
};

$(document).ready(fbstats.init);