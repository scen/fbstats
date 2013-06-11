// ==UserScript==
// @name       FBMSG Statstics
// @namespace  fbmsgstats
// @version    1.0
// @match      file:///*messages.html
// @copyright  2013+, Stanley Cen
// @require http://code.jquery.com/jquery-latest.js
// ==/UserScript==


function process_messages()
{
    var conversations = new Array();
    $(".thread").each(function(i, obj) {
        // console.log(obj);
        var cur_conv = {};

        cur_conv.people = new Array();
        $(obj).find(".border > .header > .profile").each(function(idx, o){
            cur_conv.people.push($(o).html());
        });

        cur_conv.last_message = $($(obj).find(".time, .published")[0]).html();

        var messages = $(obj).find(".message");

        cur_conv.messages = {};
        cur_conv.message_count = 0;

        messages.each(function(idx, message) {
            var from = $($(message).find(".profile, .fn")[0]).html();
            if (cur_conv.messages[from] == null)
            {
                cur_conv.messages[from] = 1;
            }
            else
            {
                cur_conv.messages[from]++;
            }
            cur_conv.message_count++;
        });

        conversations.push(cur_conv);
    });
    return conversations;
}

function round_half(num)
{
    return Math.round(num * 2) / 2;
}

function output_stats_console(conversations)
{
    $.each(conversations, function(i, conv){
        console.log("Conversation between: " + conv.people.join(", "));
        console.log("\tTotal messages: " + conv.message_count);
        $.each(conv.messages, function(author, count){
            console.log("\t\t" + author + " sent " + count + " messages (" + round_half(100 * count / conv.message_count) + "%).");
        });
    });
}

var button = $("<button>Process messages</button>");
button.click(function(){
    var conversations = process_messages();
    output_stats_console(conversations);
});
$("#content").prepend(button);

