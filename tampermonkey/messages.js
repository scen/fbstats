// ==UserScript==
// @name       FBMSG Statstics
// @namespace  fbmsgstats
// @version    1.0
// @match      file:///*messages.html
// @copyright  2013+, Stanley Cen
// @require    http://code.jquery.com/jquery-latest.js
// @require    http://cdn.jsdelivr.net/json2/0.1/json2.min.js
// ==/UserScript==


function process_messages()
{
    var conversations = {};
    conversations.threads = new Array();

    conversations.my_name = $($("#rhs > h1")).html();
    conversations.my_url = $($(".downloadnotice > a")).attr("href");

    console.log($($(".downloadnotice")).html().split("</a>) on ")[1].replace(" at", ''));

    // return conversations;

    $(".thread").each(function(i, obj) {
        // console.log(obj);
        var cur_conv = {};

        cur_conv.people = new Array();
        $(obj).find(".border > .header > .profile").each(function(idx, o){
            cur_conv.people.push($(o).html());
        });

        cur_conv.last_message = $($(obj).find(".time, .published")[0]).html();

        var messages = $(obj).find(".message");

        cur_conv.author_message_count = {};
        cur_conv.messages = new Array();
        cur_conv.message_count = 0;

        messages.each(function(idx, message) {
            var from = $($(message).find(".profile, .fn")[0]).html();

            var cur_message = {};

            var date_str = $($(message).find(".time, .published")[0]).attr("title");
            var date_obj = new Date(date_str);

            // ewww. WHY JAVASCRIPT WHY
            var epoch_sec = Date.UTC(date_obj.getFullYear(), date_obj.getMonth(), date_obj.getDay(), 
                date_obj.getHours(), date_obj.getMinutes(), date_obj.getSeconds(), date_obj.getMilliseconds()) / 1000; // convert from milliseconds to seconds
            cur_message.timestamp = epoch_sec;

            var msg_body = $($(message).find(".msgbody")[0]).html();

            msg_body = msg_body.replace(/^\s+|\s+$/g,''); //strip whitespace
            cur_message.body = msg_body;

            cur_message.from = from;

            // console.log(cur_message);

            cur_conv.messages.push(cur_message);

            // increment individual message counters
            if (cur_conv.author_message_count[from] == null)
            {
                cur_conv.author_message_count[from] = 1;
            }
            else
            {
                cur_conv.author_message_count[from]++;
            }
            cur_conv.message_count++;
        });

        conversations.threads.push(cur_conv);
    });

    return conversations;
}

function round_half(num)
{
    return Math.round(num * 2) / 2;
}

function output_stats_console(conversations)
{
    $.each(conversations.threads, function(i, conv){
        console.log("Conversation between: " + conv.people.join(", "));
        console.log("\tTotal messages: " + conv.message_count);
        $.each(conv.author_message_count, function(author, count){
            console.log("\t\t" + author + " sent " + count + " messages (" + round_half(100 * count / conv.message_count) + "%).");
        });
    });
}

function dump_json(conversations)
{
    console.log(JSON.stringify(conversations));
}

var button = $("<button>Process messages</button>");
button.click(function(){
    var conversations = process_messages();
    output_stats_console(conversations);
    // dump_json(conversations);
});
$("#content").prepend(button);

