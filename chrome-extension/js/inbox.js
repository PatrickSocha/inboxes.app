var domain = "https://api.inboxes.app";
var version = '0.0.5';
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
            $('#disposableEmailForm').val(data.email);
        }
    });
}

async function getInbox() {
    setNavigationState(
        ['viewUnreadButton', 'viewSettingsButton'],
        'viewUnreadButton',
        ['viewInboxContainer']
    );

    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_inbox',
        dataType: 'json',
        success: function (data) {
            if (data === null || data.length === 0) {
                $("#load").load("views/viewInboxZero.html").fadeIn(fadeTimer);
                return
            }
            populateMessageList(data);
        }
    });
}

async function getReadInbox() {
    setNavigationState(
        ['viewReadButton', 'viewSettingsButton'],
        'viewReadButton',
        ['viewInboxContainer']
    );

    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_read_inbox',
        dataType: 'json',
        success: function (data) {
            if (data === null || data.length === 0) {
                $("#load").load("views/viewEmptyUnread.html").fadeIn(fadeTimer);
                return
            }
            populateMessageList(data);
        }
    });
}

function populateMessageList(data) {
    $.each(data, function (index, element) {
        const cl = ".em-" + index;
        $('.em').clone()
            .addClass("em-" + index)
            .removeClass("em")
            .appendTo(".list")
            .fadeIn(fadeTimer)

        const deleteElem = cl + ' .delete-button';
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
            $('#iframe').attr("srcdoc", emailBody);
            $("#iframe").on('load', function () {
                $('#viewMessageContainer').show()

                var body = this.contentWindow.document.body,
                    html = this.contentWindow.document.documentElement;

                var height = Math.max(body.scrollHeight, body.offsetHeight,
                    html.clientHeight, html.scrollHeight, html.offsetHeight);

                this.style.height = height + 'px';
            });

            // $('#viewMessageContainer').css("height", height + "px")
            $('.message').fadeIn(fadeTimer);
            $('#list').fadeOut(fadeTimer);

        }
    });
}


function updateEmail() {
    const email = $("#emailForm").val();

    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        data: JSON.stringify({
            "email": email,
        }),
        url: domain + '/update_account_email',
        dataType: 'json',
        success: function (data) {
            if (data)
                showNews(data);
        }
    });
}

function verifyAccountEmail() {
    const codeParts = [];
    for (let i = 0; i < 5; i++) {
        codeParts.push($("#validation-" + i).val());
    }
    const code = codeParts.join('');

    $("#load").load("views/verifying.html").fadeIn(fadeTimer);

    setTimeout(function () {
        $.ajax({
            type: 'POST',
            beforeSend: function (request) {
                request.setRequestHeader("Authorization", key);
            },
            data: JSON.stringify({ "code": code }),
            url: domain + '/verify_account_email',
            dataType: 'json',
            success: function (data) {
                toggleConfetti();
                $("#verifyingSpinner").remove()
                $("#verifyingHeader").text("Email updated 👌")
                setTimeout(function () {
                    toggleConfetti();
                }, 1500)
            },
            error: function () {
                $("#verifyingSpinner").remove()
                $("#verifyingHeader").text("Invalid code")
                $("#verifyingText").text("Check you entered the correct code and try again.")
            }
        });

    }, 1000);


}

function getSettings() {
    setNavigationState(
        ['viewReadButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['view']);

    $("#load").load("views/viewSettings.html").fadeIn(fadeTimer);
}

function getViewEditEmail() {
    setNavigationState(
        ['viewReadButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['view']);

    $("#load").load("views/viewEditEmail.html").fadeIn(fadeTimer);
}

function getViewValidateAction() {
    setNavigationState(
        ['viewReadButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['view']
    );

    $("body").on('keyup', '.actions-form', function (e) {
        if (e.keyCode === 8) {
            $(this).prev().focus()
        } else {
            $(this).next().focus()
        }
    });

    $("body").on('keyup', '.actions-form', function (e) {
        let count = 0
        for (let i = 0; i < 5; i++) {
            if ($('#validation-' + i).val() !== ""){
                count++;
            }
        }
        if (count === 5) {
            $('#verifyAccountEmail').attr("disabled", false);
        } else {
            $('#verifyAccountEmail').attr("disabled", true);
        }
    });

    $('body').on('paste', '.actions-form', function (e) {
        var pasteData = e.originalEvent.clipboardData.getData('text').split("");
        if (pasteData.length !== 5) {
            pasteData = void 0; // unset data, we shouldn't store it.
            return
        }

        for (let i = 0; i < 5; i++) {
            $('#validation-' + i).val(pasteData[i]);
            $("#validation-" + i).select();
        }

        pasteData = void 0; // unset data, we shouldn't store it.
        setTimeout(verifyAccountEmail, 100);
    });


    $("#load").load("views/viewValidateAction.html").fadeIn(fadeTimer);
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
    $('#viewMessageContainer').fadeOut(fadeTimer)
    $('#list').delay(100).fadeIn(fadeTimer)
    $('#iframe').css("height", "0px")
}



function copyEmailAddress() {
    const copyText = document.getElementById("disposableEmailForm");
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
    // views
    $(document).delegate("#closeEmail", "click", closeEmail);
    $(document).delegate("#disposableEmailForm", "click", copyEmailAddress);
    $(document).delegate("#viewReadButton", "click", getInbox);
    $(document).delegate("#viewUnreadButton", "click", getReadInbox);
    $(document).delegate("#viewSettingsButton", "click", getSettings);
    $(document).delegate("#viewEditEmail", "click", getViewEditEmail);
    $(document).delegate("#viewValidateAction", "click", getViewValidateAction);

    // forms
    $(document).delegate("#updateEmail", "click", updateEmail);
    $(document).delegate("#verifyAccountEmail", "click", verifyAccountEmail);
});

// //
// Helpers
//
function setKey(keyObj) {
    chrome.storage.sync.set(keyObj);
}
function deleteKey(key) {
    chrome.storage.sync.remove(key, function () {
        console.log('key deleted');
    });
}

// // //
// Nav
//

// state control
const setupViewState = {
    viewSettingsButton: true,
    viewUnreadButton: false,
    viewReadButton: false,

    viewInboxContainer: true,
    load: false
}

function setNavigationState(nav, navHighlight, showState) {
    // copy default view setup
    const currentState = jQuery.extend({}, setupViewState);

    // reset then set highlighted nav bar item
    for (const [k, v] of Object.entries(currentState)) {
        $('#' + k).removeClass('selected');
    }
    if (typeof navHighlight === 'string') {
        $('#' + navHighlight).addClass('selected');
    }

    // toggle nav and view states
    for (const i in nav) {
        currentState[nav[i]] = true;
    }
    for (const i in showState) {
        currentState[showState[i]] = true;
    }

    // paint states
    for (const [k, v] of Object.entries(currentState)) {
        if (v === true)
            $('#' + k).show()
        if (v === false)
            $('#' + k).hide()
    }

    // reset states
    $('.list').empty();
    closeEmail();
}
