APP_ID = '167939483377379';

var fbstats = fbstats || {};
fbstats.fs_bytes = 30 * 1024 * 1024; // 30 MB
API_CALL_DELAY = 2100; // ms
API_TIMEOUT_DELAY = 1000 * 60 * 5; // 5 minutes
API_TIMEOUT_MESSAGE = "Facebook API timed out. Auto-retrying in 5 minutes";

function call_delay(lambda) {
    setTimeout(lambda, API_CALL_DELAY);
}

function round_tenth(num)
{
    return parseFloat((Math.round(num * 10) / 10).toFixed(1));
}

function log_fbapi(url, opts)
{
    var lambda = function(obj){
        console.log(obj);
    };
    if (opts == null) FB.api(url, lambda);
    else FB.api(url, opts, lambda);
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

fbstats.check_cache = function () {

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
    if (fbstats.me != null)
    {
        fbstats.update_from_cache(function(){
            console.log(window.location.hash);
            var hash = window.location.hash == "" ? "settings" : location.hash.slice(1);
            console.log($("#" + hash));
            fbstats.sim_click($("#" + hash)[0]);
            fbstats.nav_to(hash);
        });
    }
    else
    {
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

            if (data != null && data.comments != null && data.comments.data != null)
            {
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
            }
            else
            {
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

fbstats.get_thread = function (thread, idx, len) {
    thread.messages = [];
    FB.api('/' + thread.id, {
        limit: 500
    }, function (data) {
        // some parts are null
        // or if it's an event.
        if (data == null || data.from == null || (data.from != null && data.from.end_time != null)) {
            thread.bad = true; // indicates whether or not this thread should be processed. bad = insufficient information
            fbstats.print_download_console("Thread " + (idx + 1) + " of " + len + ": bad thread encountered... skipping");
            call_delay(function () {
                fbstats.get_all_threads_helper(idx + 1, len);
            }); // "continue"
            return;
        }
        fbstats.get_thread_part2(thread, idx, len, data);
    });
};


// this function recursively calls itself on the next index after waiting at the tail
// quick-hack for facebook's API limits

fbstats.set_progress_bar = function (num) {
    if (num == 0)
    {
        $("#progress_bar").hide();
        $("#progress_bar").remove();
        $("#download_progress").append($('<div class="bar" id="progress_bar" style="width: 0%"></div>'));
        return;
    }
    $("#progress_bar").css("width", (num * 100) + "%");
};

fbstats.get_all_threads_helper = function (idx, len) {
    if (idx >= len) {
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
        return;
    }

    fbstats.set_progress_bar(idx / len);

    call_delay(function () {
        fbstats.get_thread(fbstats.data.threads[idx], idx, len);
    });
};

fbstats.get_all_threads = function () {
    fbstats.print_download_console("Counted " + fbstats.data.threads.length + " total threads");

    fbstats.get_all_threads_helper(0, fbstats.data.threads.length);

    // $.each(fbstats.data.threads, function(idx, thread){
    //     fbstats.get_thread(thread);
    // });
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
        $.each(thread.to.data, function (idx, person) {
            current_thread.people.push(person.id);
            if (fbstats.data.people[person.id] == null) fbstats.data.people[person.id] = {};
            if (fbstats.data.people[person.id].name == null) fbstats.data.people[person.id].name = person.name;
        });
        fbstats.data.threads.push(current_thread);
    });
    fbstats.process_thread_list_recurse(partial_list);
};

fbstats.on_fs_init = function (fs) {
    console.log('successfully opened file system: ' + fs.name);
    fbstats.fs = fs;
};

fbstats.update_nav = function()
{
    var tbody = $("#overview_table > tbody");
    fbstats.tid_to_idx = {};
    $.each(fbstats.data.threads, function (idx, thread){
        fbstats.tid_to_idx[thread.id] = idx;
        if (thread.bad == null)
        {
            // generate list of names           
            var except_me = [];
            $.each(thread.people, function(idx, id){
                if (id != fbstats.me.id)
                {
                    except_me.push(fbstats.data.people[id].name);
                }
            });
            var names_without_me = except_me.join(', ');

            // compute char_count
            var char_count = 0;
            $.each(thread.messages, function(idx, msg){
                if (msg.body != null)
                {
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

fbstats.regen_overview_table = function() {
    return $('#overview_table').dataTable( {
        bDestroy: true,
        sPaginationType: "bootstrap",
        iDisplayLength: 25,
        oLanguage: {
            sLengthMenu: "_MENU_ threads per page"
        },
        bAutoWidth: false,
        aaSorting: [[0, "desc"]],
        aLengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
        aoColumns: [
            {
                sType: "date", 
                bSortable: true,
                sWidth: "20%"
            },
            {
                bSortable: true,
                sWidth: "50%"
            },
            {
                sWidth: "15%",
                bSortable: true,
            },
            {
                sWidth: "15%",
                bSortable: true,
            }
        ]
    });
};

fbstats.update_from_cache = function (success) {
    fbstats.update_alert('error', '<strong>Error!</strong> Message data has not been collected yet. Go to Settings to collect data.');
    $(".navbar_conversation").remove();
    $("#overview_table > tbody > tr").remove();
    $(".main_conversation").remove();
    fbstats.regen_overview_table().fnClearTable();
    fbstats.did_gen_thread = {};
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
                    e.attr("download", fbstats.me.first_name+fbstats.me.last_name+"_"+fbstats.me.id+".txt");
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
    }, function(err){
        $.unblockUI();
        if (success != null) success();
    });
};

fbstats.create_word_cloud = function(tid)
{
    
}

fbstats.generate_trends = function(tid, typeid)
{
    typeid = typeid || "message";
    var thread = fbstats.data.threads[fbstats.tid_to_idx[tid]];
    var trends = $('#' + tid + "_trends");

    var trend_chart = $('#' + tid + '_trendchart');

    var lambda_recreate_chart = function(data_series, t, yax) {
        trend_chart.highcharts({
            chart: {
                zoomType: 'x',
                type: 'line',
                marginTop: 80
            },
            credits: {enabled:false},
            title: {text: t},
            subtitle: {text: 'Click and drag in the plot to zoom in.<br/>Click the data sets in the legend to toggle data visibility.'},
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
    while (first_date <= today)
    {
        var idx = [first_date.getFullYear(), first_date.getMonth() + 1, first_date.getDate()];
        var cnt = fbstats.message_count_per_day[tid][idx] || 0;
        var charcnt = fbstats.character_count_per_day[tid][idx] || 0;
        cur_character_count += charcnt;
        cur_message_count += cnt;
        total_msg_chart_data.data.push(cnt);
        total_char_chart_data.data.push(cnt);
        first_date.setDate(first_date.getDate() + 1);
        elapsed_days ++;
        avg_msg_per_day.data.push(cur_message_count / elapsed_days);
        avg_char_per_day.data.push(cur_character_count / elapsed_days);
    }
    all_message_data.push(total_msg_chart_data);
    all_message_data.push(avg_msg_per_day);
    all_character_data.push(total_char_chart_data);
    all_character_data.push(avg_char_per_day);
    $.each(thread.people, function(idx, id){
        if (fbstats.person_msg_count[tid][id] > 0)
        {
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
            while (first_date <= today)
            {
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
            title: {text: "Messages per day"}, 
            startOnTick: false,
            id: "MSG_AXIS"
        };
    var CHAR_AXIS = {
            title: {text: "Characters per day"}, 
            startOnTick: false,
            id: "CHAR_AXIS",
            opposite: (typeid == 'both')
        };
    console.log([MSG_AXIS, CHAR_AXIS]);
    if (typeid == 'both')
    {
        lambda_recreate_chart($.merge(all_message_data, all_character_data), "Messages and Characters", [MSG_AXIS, CHAR_AXIS]);
    }
    else if (typeid == 'message')
    {
        lambda_recreate_chart(all_message_data, "Messages", MSG_AXIS);
    }
    else if (typeid == 'character')
    {
        lambda_recreate_chart(all_character_data, "Characters", CHAR_AXIS);
    }
}

fbstats.gen_thread = function(tid)
{
    var thread = fbstats.data.threads[fbstats.tid_to_idx[tid]];
    if (thread.bad == null)
    {
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
        $.each(thread.messages, function(idx, msg){
            try{
            mtable += "<tr><td>" + msg.id + "</td><td>" + fbstats.data.people[msg.from].name + "</td><td>" +
                (new Date(msg.timestamp)).toLocaleString() + "</td><td>" + (msg.body == null ? "" : msg.body) + "</td></tr>";
            } catch(err)
            {
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
            if (msg.body != null)
            {
                var len = msg.body.length;
                char_count += len;
                fbstats.person_char_count[tid][msg.from] = fbstats.person_char_count[tid][msg.from] == null ? len : fbstats.person_char_count[tid][msg.from] +
                    len;
                fbstats.character_count_per_day[tid][ds] = fbstats.character_count_per_day[tid][ds] || 0;
                fbstats.character_count_per_day[tid][ds] += len; 
                fbstats.character_count_per_day_per_person[tid][ds] = fbstats.character_count_per_day_per_person[tid][ds] || {};
                fbstats.character_count_per_day_per_person[tid][ds][msg.from] = fbstats.character_count_per_day_per_person[tid][ds][msg.from] || 0;
                fbstats.character_count_per_day_per_person[tid][ds][msg.from] += len;
            }
            else
            {
                console.log("null message");
            }
        });
        mtable += "</tbody>";

        var except_me = [];
        $.each(thread.people, function(idx, id){
            if (id != fbstats.me.id)
            {
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
        tabs.append($("<li><a class='thread_tab' data-tid='" + thread.id + "' data-toggle='tab' href='#" + thread.id + "_words'>Word cloud</a></li>"));
        tabs.append($("<li><a class='thread_tab' data-tid='" + thread.id + "' data-toggle='tab' href='#" + thread.id + "_active'>Most active</a></li>"));
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
        $.each(thread.people, function(idx, id){
            table2html += "<tr><td>" + fbstats.data.people[id].name + "</td><td>" + (fbstats.person_msg_count[tid][id] || 0)
                + "</td><td>" + round_tenth(100 * (fbstats.person_msg_count[tid][id] || 0) / thread.messages.length) + "</td><td>" +
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
            credits:{enabled:false},
            series: [{
                type: 'pie',
                name: 'Message %',
                data: $.map(fbstats.person_msg_count[tid], function(val, key){
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
            credits:{enabled:false},
            series: [{
                type: 'pie',
                name: 'Character %',
                data: $.map(fbstats.person_char_count[tid], function(val, key){
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

        mainelem.append(tab_content);

        emtable.dataTable({
            bDestroy: true,
            aaSorting: [[0, 'asc']],
            sPaginationType: "bootstrap",
            iDisplayLength: 100,
            aLengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
            oLanguage: {
                sLengthMenu: "_MENU_ messages per page"
            },
            bAutoWidth: false,
            aoColumns: [
            {
                bSortable: true,
                sWidth: "5%"
            },
            {
                sWidth: "15%",
                bSortable: true,
            },
            {
                sType: "date", 
                bSortable: true,
                sWidth: "15%"
            },
            {
                bSortable: true,
            }
        ]
        });

        table2.dataTable({
            bDestroy: true,
            aLengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
            aaSorting: [[1, "desc"]],
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

fbstats.sim_click = function(obj)
{
    $(".navbar_entry").each(function (idx, obj) {
        $(obj).parent().removeClass("active");
    });
    if ($(obj).parent().hasClass("navbar_conversation"))
    {
        var id = $(obj).attr('id');
        if (fbstats.did_gen_thread[id] == null)
        {
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

    FB.api('/me/inbox', {
        limit: 500
    }, function (inbox) {
        if (fbstats.is_api_timeout_error(inbox)) {
            fbstats.print_download_console(API_TIMEOUT_MESSAGE);
            setTimeout(fbstats.retrieve_btn_click, API_TIMEOUT_DELAY);
        } else {
            call_delay(fbstats.process_thread_list(inbox));
        }
    });
};

fbstats.blockUI = function()
{
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
        bootbox.confirm("Are you sure you want to clear all of your data from your local cache? (you will have to redownload all of it)", function(res){
            if (res == true)
            {
                var lambda = function(arg) {
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
    db.on("drop", function(evt){
        evt.stopPropagation();
        evt.preventDefault();
        db.removeClass("highlight_border");
        var fn = evt.dataTransfer.files[0].name;
        var ff = evt.dataTransfer.files[0];
        bootbox.confirm("Would you like to load data from " + fn + "?", function(response){
            if (!response)
            {
                fbstats.set_progress_bar(0);
                return;
            }
            var reader = new FileReader();
            reader.onload = function(e){
                fbstats.set_progress_bar(0);
                try
                {
                    if (e.target.readyState != 2) return;
                    if (e.target.error)
                    {
                        throw error.toString();
                    }
                    var txt = e.target.result;
                    var obj = JSON.parse(txt);

                    if (obj == null || obj.timestamp == null || obj.threads == null || obj.people == null)
                    {
                        throw "invalid file format";
                    }
                    else
                    {
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
                }
                catch (err)
                {
                    bootbox.alert("An error occured while reading the file: " + err.toString());
                }
            };
            reader.readAsText(ff);
        });
    }).on("dragenter dragleave dragover", function(evt){
        evt.stopPropagation();
        evt.preventDefault();
        if(evt.type == "dragenter")
        {
            db.addClass("highlight_border");
        }
        else if (evt.type == "dragleave")
        {
            db.removeClass("highlight_border");
        }
    });


    $(window).hashchange(function(){
        fbstats.sim_click($('#' + location.hash.slice(1)));
    });

    $("#delta_update").click(function(){
        $(this).button('loading');
        call_delay(function(){ $("#delta_update").button('reset'); });
    });

    $(document).on('click', '.thread_tab', function(evt){
        var tgt = $(evt.target);
        if (tgt.attr('data-tab-type') == 'trends')
        {
            var id = tgt.attr('data-tid');
            if (fbstats.did_gen_trends[id] == null)
            {
                fbstats.generate_trends(id);
                fbstats.did_gen_trends[id] = true;
            }
        }
    });

    $(document).on('click', '.overview_table_row', function(evt){
        var id = $(evt.target).parent().attr('data-id');
        if (id == null) return false;
        fbstats.sim_click($('#' + id));
    });

    $(document).on('click', '.metric_button', function(evt){
        var tgt = $(evt.target);
        var metric = tgt.attr('data-metric');
        var id = tgt.attr('data-tid');
        fbstats.generate_trends(id, metric);
    });

    setTimeout(function() {
        if (location.hash)
        {
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