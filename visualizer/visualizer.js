APP_ID = '167939483377379';

var fbstats = fbstats || {};
fbstats.fs_bytes = 30 * 1024 * 1024; // 30 MB
API_CALL_DELAY = 2100; // ms
API_TIMEOUT_DELAY = 1000 * 60 * 5; // 5 minutes
API_TIMEOUT_MESSAGE = "Facebook API timed out. Auto-retrying in 5 minutes";

function call_delay(lambda) {
    setTimeout(lambda, API_CALL_DELAY);
}

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
    $("#" + name + "_content").show();
    console.log(name);
    fbstats.set_title($("#" + name).attr("header"));
};

fbstats.finish_auth = function () {
    fbstats.update_from_cache();
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
        initial_message.body = data.message;
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
        if (data == null || data.from == null) {
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

fbstats.update_statistics = function()
{
    $.each(fbstats.data.threads, function (idx, thread){
        if (thread.bad == null)
        {
            var names = thread.people.map(function (id) {
                return fbstats.data.people[id].name;
            }).join(", ");
            var elem = $("<li class='navbar_conversation'><a href='#' id='" + thread.id + "' class='navbar_entry' header='Conversation between " +
                names + "'>" + names + "</a></li>");
            $("#sidenav").append(elem);
        }
    });
}

fbstats.update_from_cache = function (fs) {
    fbstats.update_alert('error', '<strong>Error!</strong> Message data has not been collected yet. Go to Settings to collect data.');
    $(".navbar_conversation").hide().remove();
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
                    fbstats.update_statistics();
                }
            }
        } catch (err) {
            console.log(err);
        }
    });
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

fbstats.read_file = function (name, success) {
    fbstats.fs.root.getFile(name, {
        create: false
    }, function (file_entry) {
        file_entry.file(function (file) {
            var reader = new FileReader();
            reader.onloadend = function (e) {
                if (success != null) success(e, this, file_entry);
            };
            reader.readAsText(file);
        }, fbstats.fs_error_handler);
    }, fbstats.fs_error_handler);
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

fbstats.init = function () {
    window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    if (!FileReader || !window.requestFileSystem || !Modernizr.localstorage) {
        fbstats.update_alert('error alert-block',
            "<strong>Error: Browser not supported!</strong> This browser does not support the HTML5 File APIs and cannot continue. Google Chrome is the only browser with a working implementation of this API.");
        return;
    }
    $.blockUI({
        message: "<h4>initializing, please wait...</h4>"
    });
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
                    $.unblockUI();
                    fbstats.finish_auth();
                });
            } else {
                $("#login_facebook").show();
                $.unblockUI();
            }
        });
    };

    jQuery.event.props.push("dataTransfer");

    fbstats.nav_to("settings");

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
        $(".navbar_entry").each(function (idx, obj) {
            $(obj).parent().removeClass("active");
        });
        var obj = evt.currentTarget;
        console.log(obj);
        $(obj).parent().addClass("active");
        fbstats.nav_to($(obj).attr("id"));
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