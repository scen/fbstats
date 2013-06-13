var fbstats = fbstats || {};
fbstats.fs_bytes = 30 * 1024 * 1024; // 30 MB

// stolen from: http://www.netlobo.com/url_query_string_javascript.html
fbstats.get_url_param = function(name)
{
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");  
    var regexS = "[\\?&]"+name+"=([^&#]*)";  
    var regex = new RegExp(regexS);  
    var results = regex.exec(window.location.href); 
    if (results == null) return null;
    else return results[1];
}


fbstats.update_alert = function(type, html)
{
    $("#top_notification").removeClass();
    $("#top_notification").addClass("alert alert-" + type);
    console.log(html);
    $("#top_notification").html(html);
}

fbstats.check_cache = function()
{

}

fbstats.set_title = function(name)
{
    $("#cur_page_title").html(name);
}

fbstats.nav_to = function(name)
{
    $("#page_content > div").each(function(idx, obj){
        $(obj).hide();
    });
    $("#" + name + "_content").show();
    fbstats.set_title($("#" + name).attr("header"));
}

fbstats.finish_auth = function()
{
    fbstats.update_alert('error', '<strong>Error!</strong> Message data has not been collected yet. Go to Settings to collect data.');
}


fbstats.get_thread = function(thread)
{
    thread.messages = [];
    FB.api('/' + thread.id, function(data){
        initial_message = {};
        initial_message.from = data.from.id;
        initial_message.body = data.message;

        fbstats.print_download_console("New thread! People: " + thread.people.map(function(id) { return fbstats.data.people[id].name; }).join(", "));

        /*
            So apparently the Facebook Graph API doesn't give you the created_time of the first message.
            We use FQL to extract this information.
            Thank this person: http://stackoverflow.com/questions/11762428/read-created-time-of-first-message-in-conversation
        */

        FB.api('fql', {q: ('SELECT created_time FROM message WHERE thread_id="' + thread.id + '" LIMIT 1')}, function(response){
            var the_date = new Date(response.data[0].created_time * 1000); // convert to ms
            initial_message.timestamp = the_date.toISOString(); 
            thread.messages.push(initial_message);
        });
    });
}

fbstats.get_all_threads = function()
{
    fbstats.print_download_console("Counted " + fbstats.data.threads.length + " total threads");
    $.each(fbstats.data.threads, function(idx, thread){
        fbstats.get_thread(thread);
    });
}

fbstats.process_thread_list = function(partial_list)
{
    console.log(partial_list);
    if (partial_list.data.length == 0) return fbstats.get_all_threads(); // no more threads to process
    fbstats.print_download_console("Recieved block of " + partial_list.data.length + " threads");
    $.each(partial_list.data, function(idx, thread){
        current_thread = {};
        current_thread.people = [];
        current_thread.id = thread.id;
        $.each(thread.to.data, function(idx, person){
            current_thread.people.push(person.id);
            if (fbstats.data.people[person.id] == null) fbstats.data.people[person.id] = {};
            if (fbstats.data.people[person.id].name == null) fbstats.data.people[person.id].name = person.name;
        });
        fbstats.data.threads.push(current_thread);
    });
    $.getJSON(partial_list.paging.next, fbstats.process_thread_list);
}

fbstats.on_fs_init = function(fs)
{
    console.log('successfully opened file system: ' + fs.name);
    fbstats.fs = fs;
}

fbstats.fs_error_handler = function(e) {
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
    };
    console.log('error: ' + msg);
}

fbstats.print_download_console = function(text)
{
    var e = $("#debug_console_download");
    var cur = e.html();
    e.html("[" + (new Date()).toLocaleString() + "] " + text + "\n" + cur);
}

fbstats.init = function()
{
    window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    if (!FileReader || !window.requestFileSystem || !Modernizr.localstorage)
    {
        fbstats.update_alert('error alert-block', 
            "<strong>Error: Browser not supported!</strong> This browser does not support the HTML5 File APIs and cannot continue. Google Chrome is the only browser with a working implementation of this API.");
        return;
    }
    $.blockUI({message: "<h4>initializing, please wait...</h4>"});
    window.fbAsyncInit = function() {
        FB.init({
            appId: '167939483377379',
            status: true,
            xfbml: false
        });
        console.log("facebook api initialized.");

        FB.getLoginStatus(function(resp) {
            if (resp.status == "connected")
            {
                FB.api('/me', function(me) {
                    fbstats.me = me;
                    $("#uname").html(me.name);
                    $("#user_dropdown").show();
                    $.unblockUI();
                    fbstats.finish_auth();
                });
            }
            else
            {
                $("#login_facebook").show();
                $.unblockUI();
            }
        });
    };

    fbstats.nav_to("overview");

    $("#login_with_facebook").click(function() {
        FB.login(function(response) {
            console.log(response);
            if (response.authResponse)
            {
                FB.api('/me', function(me) {
                    fbstats.me = me;
                    $("#uname").html(me.name);
                    $("#login_facebook").hide();
                    $("#user_dropdown").show();
                    fbstats.finish_auth();
                });
            }
        }, {scope: "read_mailbox"});
    });

    $("#clear_cache_btn").click(function() {
        localStorage.clear();
        $("#last_update_settings").html("None");
    });

    $("#retrieve_btn").click(function() {
        // $("#last_update_settings").html((new Date()).toString());

        // initialize data object
        fbstats.data = {};
        fbstats.data.threads = [];
        fbstats.data.people = {};

        fbstats.print_download_console("Started downloading initial thread list");

        FB.api('/me/inbox', function(inbox){
            fbstats.process_thread_list(inbox);
        });
    });

    $("#facebook_logout").click(function() {
        FB.logout(function(response) { location.reload(true); });
    });

    $(".navbar_entry").click(function(evt) {
        $(".navbar_entry").each(function(idx, obj) {
            $(obj).parent().removeClass("active");
        });
        var obj = evt.currentTarget;
        $(obj).parent().addClass("active");
        fbstats.nav_to($(obj).attr("id"));
    });

    // initialize file system stuff
    window.webkitStorageInfo.requestQuota(window.PERSISTENT, fbstats.fs_bytes, function(grantedBytes){
        console.log("granted " + grantedBytes + " bytes of storage");
        window.requestFileSystem(window.PERSISTENT, grantedBytes, fbstats.on_fs_init, fbstats.fs_error_handler);
    });


    (function(d, s, id) {
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) {return;}
        js = d.createElement(s); js.id = id;
        js.src = "http://connect.facebook.net/en_US/all.js";
        fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
}

$(document).ready(fbstats.init);

