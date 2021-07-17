var domain = "https://api.inboxes.app";
var fadeTimer = 200
var version = '0.0.2'

chrome.storage.sync.get(["key"], function (result) {
    if (result.key) {
        run(result.key)
        return
    }

    createAccount()
});

function createAccount() {
    $.ajax({
        type: 'GET',
        url: domain + '/create_account',
        dataType: 'json',
        success: function (data) {
            setKey({ "key": data.key });
            run(data.key);
        }
    });
}

function run(key) {
    getNewEmail(key)
    getInbox(key)
    getNews(key)
    incrementAppUsageCounter()
}

async function getNewEmail(key) {
    $.ajax({
        type: 'GET',
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

async function getInbox(key) {
    $('#message-container').hide()
    $.ajax({
        type: 'GET',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_inbox',
        dataType: 'json',
        success: function (data) {
            if (data.length == 0) {
                $('.inbox-zero').fadeIn(fadeTimer)
                return
            }
            $.each(data, function (index, element) {
                var cl = ".em-" + index
                $('.em').clone()
                    .addClass("em-" + index)
                    .removeClass("em")
                    .appendTo(".list")
                    .show()

                var deleteElem = cl + ' .delete-button'
                $(cl).on("click", function (e) {
                    if ($(e.target).is(deleteElem)) {
                        // console.log(e.target)
                        return false;
                    }
                    openEmail(key, element.ID)
                });
                $(cl + ' #subject').text(element.Subject)

                $(deleteElem).on("click", function () {
                    deleteInbox(key, element.To, cl)
                });

            });
        }
    });
}

function openEmail(key, id) {
    $("html, body").animate({ scrollTop: 0 }, 250);
    $.ajax({
        type: 'GET',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_email',
        data: { id },
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

function deleteInbox(key, email, elem) {
    $.ajax({
        type: 'GET',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/delete_inbox',
        data: { email },
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

$(document).ready(function () {
    $("#closeEmail").click(closeEmail);
});

$(document).ready(function () {
    $("#emailForm").click(copyEmailAddress);
});



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

function getNews(key) {
    chrome.storage.sync.get("appUsageCounter", function (obj) {
        $.ajax({
            type: 'GET',
            beforeSend: function (request) {
                request.setRequestHeader("Authorization", key);
            },
            data: {
                "app_opens": obj.appUsageCounter,
                "app_version": version
            },
            url: domain + '/get_news',
            dataType: 'json',
            success: function (data) {
                if (data) {
                    showNews(data.news);
                }
            }
        });
    });
}

function showNews(text) {
    $('#news').show();
    $('#news-content').html(text);
}

function setKey(keyObj) {
    chrome.storage.sync.set(keyObj);
}
function deleteKey(key) {
    chrome.storage.sync.remove(key, function () {
        console.log('key deleted');
    });
}