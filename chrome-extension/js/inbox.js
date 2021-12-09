var domain = "https://api.inboxes.app";
var version = '0.0.4';
let key;
var fadeTimer = 200;

chrome.storage.sync.get(["key"], function (result) {
    if (result.key) {
        key = result.key
        return run();
    }

    createAccount()
});

function createAccount() {
    $.ajax({
        type: 'POST',
        url: domain + '/create_account',
        dataType: 'json',
        success: function (data) {
            setKey({ "key": data.key });
            run();
        }
    });
}

function run() {
    getNewEmail()
    getInbox()
    getNews()
    incrementAppUsageCounter()
}

async function getNewEmail() {
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_new_address',
        dataType: 'json',
        success: function (data) {
            $('.emailForm').val(data.email);
        }
    });
}

async function getInbox() {
    resetState();
    $('#viewReadButton').show();

    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_inbox',
        dataType: 'json',
        success: function (data) {
            if (data.length == 0) {
                $('#empty-read').fadeIn(fadeTimer)
                return
            }
            populateMessageList(data);
        }
    });
}

async function getUnreadInbox() {
    resetState();
    $('#viewUnreadButton').show();

    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_read_inbox',
        dataType: 'json',
        success: function (data) {
            if (data.length == 0) {
                $('#empty-unread').fadeIn(fadeTimer)
                return
            }
            populateMessageList(data);
        }
    });
}

function populateMessageList(data) {
    $.each(data, function (index, element) {
        var cl = ".em-" + index
        $('.em').clone()
            .addClass("em-" + index)
            .removeClass("em")
            .appendTo(".list")
            .fadeIn(fadeTimer)

        var deleteElem = cl + ' .delete-button'
        $(cl).on("click", function (e) {
            if ($(e.target).is(deleteElem)) {
                // console.log(e.target)
                return false;
            }
            openEmail(element.ID)
        });
        $(cl + ' #subject').text(element.Subject)

        $(deleteElem).on("click", function () {
            deleteInbox(element.To, cl)
        });

    });
}

function openEmail(id) {
    $("html, body").animate({ scrollTop: 0 }, 250);
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_email',
        data: JSON.stringify({ id }),
        dataType: 'json',
        success: function (data) {
            var emailBody = "<base target=\"_blank\" />" + data.ParsedBody
            $('#subject').text(data.Subject);
            $('#to').text(data.To);
            $("#iframe").attr("srcdoc", emailBody);
            $("#iframe").on('load', function () {
                $('#message-container').show()

                var body = this.contentWindow.document.body,
                    html = this.contentWindow.document.documentElement;

                var height = Math.max(body.scrollHeight, body.offsetHeight,
                    html.clientHeight, html.scrollHeight, html.offsetHeight);

                this.style.height = height + 'px';
            });

            // $('#message-container').css("height", height + "px")
            $('.message').fadeIn(fadeTimer)
            $('#list').fadeOut(fadeTimer)

        }
    });
}

function deleteInbox(email, elem) {
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/delete_inbox',
        data: JSON.stringify({ email }),
        dataType: 'json',
        success: function (data) {
            $(elem).fadeOut(fadeTimer)
        }
    });
}

function closeEmail() {
    $('.message').fadeOut(fadeTimer, function () {
        $('.message > .subject').text("")
        $('.message > .to').text("")
        $('.emailBody').remove()
    })
    $('#message-container').fadeOut(fadeTimer)
    $('#list').delay(100).fadeIn(fadeTimer)
    $('#iframe').css("height", "0px")
}



function copyEmailAddress() {
    var copyText = document.getElementById("emailForm");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    document.execCommand("copy");

    $(".tooltiptext").text("Copied!");
}

function incrementAppUsageCounter() {
    chrome.storage.sync.get("appUsageCounter", function (obj) {
        const i = obj.appUsageCounter
        if (i >= 0) {
            setKey({ "appUsageCounter": i + 1 })
        } else {
            setKey({ "appUsageCounter": 0 })
        }
    });
}

function getNews() {
    chrome.storage.sync.get("appUsageCounter", function (obj) {
        $.ajax({
            type: 'POST',
            beforeSend: function (request) {
                request.setRequestHeader("Authorization", key);
            },
            data: JSON.stringify({
                "app_opens": obj.appUsageCounter,
                "app_version": version
            }),
            url: domain + '/get_news',
            dataType: 'json',
            success: function (data) {
                if (data)
                    showNews(data);
            }
        });
    });
}

function showNews(data) {
    $('#news').show();
    $('#news-content').html(data.news);

    if (data.background_color)
        $('#news').css('backgroundColor', data.background_color);

    if (data.image)
        $('#news').css('background-image', 'url(' + data.image + ')');
}

// Listeners
$(document).ready(function () {
    $("#closeEmail").click(closeEmail);
    $("#emailForm").click(copyEmailAddress);
    $("#viewReadButton").click(getUnreadInbox);
    $("#viewUnreadButton").click(getInbox);
});

// Helpers
function setKey(keyObj) {
    chrome.storage.sync.set(keyObj);
}
function deleteKey(key) {
    chrome.storage.sync.remove(key, function () {
        console.log('key deleted');
    });
}

function resetState() {
    $('.inbox-zero').hide()
    $('#viewReadButton').hide()
    $('#viewUnreadButton').hide()

    $('#message-container').hide()
    $('.list').empty();
    closeEmail();
    // $('#list').delay(100).fadeIn(fadeTimer) // arguably this is all that is required.
}