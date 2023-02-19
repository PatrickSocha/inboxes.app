var domain = "https://api.inboxes.app";
var version = '0.0.6';
let key;

let subscribed = false; // if a user is a paid subscriber or not (req are verified back-end).
let quickCopy; // used hold the state and change text in the quick copy text box.
var fadeTimer = 200; // animation time in milliseconds.

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
    getEmailAddress()
    getInbox()
    getNews()
    getSubscriptionStatus()

    incrementAppUsageCounter()
}

// EMAIL
async function getEmailAddress() {
    if (quickCopy === "email") {
        return
    }

    $('#disposableEmailForm').fadeOut(fadeTimer);
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_new_address',
        dataType: 'json',
        success: function (data) {
            $('#disposableEmailForm').val(data.email)
        }
    });
    $('#disposableEmailForm').fadeIn(fadeTimer);

    quickCopy = "email"
}

async function getInbox() {
    setNavigationState(
        ['viewUnreadButton', 'viewReadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewUnreadButton',
        ['viewInboxContainer']
    );

    // document ready required for getInbox() which is the first screen ever loaded.
    $(document).ready(function() {
        $("#load").load("views/viewEmailInbox.html").fadeIn(fadeTimer);
    });

    getEmailAddress();
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
        ['viewUnreadButton', 'viewReadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewReadButton',
        ['viewInboxContainer']
    );
    $("#load").load("views/viewEmailInbox.html").fadeIn(fadeTimer);

    getEmailAddress();
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
            emailBody = emailBody.replaceAll('<script', '<script async').replaceAll('<img', '<img loading="lazy"')

            $('#subject').text(data.Subject);
            $('#to').text(data.To);
            $("#iframe-loading").show();

            $('#viewMessageContainer').show()
            $('#iframe').attr("srcdoc", emailBody);
            $("#iframe").on('load', function () {
                $("#iframe-loading").hide();
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

// Domain
async function addDomain() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['viewInboxContainer']
    );

    if (subscribed === false) {
        $("#load").load("views/viewUpgrade.html").fadeIn(fadeTimer);
        return
    }

    $("#load").load("views/viewAddDomain.html").fadeIn(fadeTimer);
}

// SMS
async function getSMSInbox() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSMSButton',
        ['viewInboxContainer']
    );

    if (subscribed === false) {
        $("#load").load("views/viewUpgrade.html").fadeIn(fadeTimer);
        return
    }
    getPhoneNumber();

    $("#load").load("views/viewSMSInbox.html").fadeIn(fadeTimer);
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_sms_inbox',
        dataType: 'json',
        success: function (data) {
            if (data === null || data.length === 0) {
                $("#load").load("views/viewInboxZero.html").fadeIn(fadeTimer);
                return
            }
            populateSMSInbox(data);
        }
    });
}

function populateSMSInbox(data) {
    $.each(data, function (index, element) {
        const cl = ".sms-msg-" + index;
        $('.sms-msg').clone()
            .addClass("sms-msg-" + index)
            .removeClass("sms-msg")
            .appendTo(".sms-list")
            .fadeIn(fadeTimer)


        $(cl).on("click", function (e) {
            // openSMSThread(element.ID)
        });

        $(cl + ' #from').text(element.from)
        $(cl + ' #message').text(element.message)

    });
}

async function getPhoneNumber() {
    if (quickCopy === "phone") {
        return
    }
    // $.ajax({
    //     type: 'POST',
    //     beforeSend: function (request) {
    //         request.setRequestHeader("Authorization", key);
    //     },
    //     url: domain + '/get_new_address',
    //     dataType: 'json',
    //     success: function (data) {
    //         $('#disposableEmailForm').val("some number").fadeIn(fadeTimer);
    //     }
    // });
    $('#disposableEmailForm').val("some number").fadeIn(fadeTimer);

    quickCopy = "phone"
}

// SETTINGS
function updateEmail() {
    $("#load").load("views/verifying.html").fadeIn(fadeTimer);
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
            $("#verifyingSpinner").remove()
            $("#verifyingHeader").text("Check your email")
            $("#verifyingText").text("Enter your unique verification code in the settings page.")
        },
        error: function (data, a) {
            $("#verifyingSpinner").remove()
            $("#verifyingHeader").text("Error updating email")
            $("#verifyingText").text(data.responseJSON.error)
        }
    });
}

function verifyAccountEmail() {
    $("#load").load("views/verifying.html").fadeIn(fadeTimer);

    const codeParts = [];
    for (let i = 0; i < 5; i++) {
        codeParts.push($("#validation-" + i).val());
    }
    const code = codeParts.join('').toUpperCase();


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
            error: function (data) {
                $("#verifyingSpinner").remove()
                $("#verifyingHeader").text("Invalid code")
                $("#verifyingText").text("Check you entered the correct code and try again.")
            }
        });

    }, 1000);


}

function getSettings() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['view']);

    getEmailAddress();
    $("#load").load("views/viewSettings.html").fadeIn(fadeTimer);
}

function getAccountSettings() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['view']);

    $("#load").load("views/viewAccountSettings.html").fadeIn(fadeTimer);
}

function getViewEditEmail() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['view']);

    $("#load").load("views/viewAttachEmail.html").fadeIn(fadeTimer);
}

function getViewValidateAction() {
    setNavigationState(
        ['viewReadButton', 'viewUnreadButton', 'viewSMSButton', 'viewSettingsButton'],
        'viewSettingsButton',
        ['view']
    );

    $('body').on('keyup', '.actions-form', function (e) {
        const keyPress = e.keyCode;
        const backspace = 8;
        const aZ09 = keyPress >= 48 && keyPress <= 90;

        if (keyPress === backspace) {
            $(this).prev().focus();
        } else if (aZ09) {
            $(this).next().focus();
        }

        let count = 0
        for (let i = 0; i < 5; i++) {
            if ($('#validation-' + i).val() !== "") {
                count++;
            }
        }

        if (count === 5) {
            setTimeout(verifyAccountEmail, 200);
        }
    });

    $('body').on('paste', '.actions-form', function (e) {
        let pasteData = e.originalEvent.clipboardData.getData('text').split("");
        if (pasteData.length !== 5) {
            pasteData = void 0; // unset data, we shouldn't store it.
            return
        }

        for (let i = 0; i < 5; i++) {
            $('#validation-' + i).val(pasteData[i]);
            $("#validation-" + i).focus();
        }
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

function getSubscriptionStatus() {
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        url: domain + '/get_subscription_status',
        dataType: 'json',
        success: function (data) {
            subscribed = data.subscribed
        }
    });
}

function upgradeAccount() {
    $('#upgradeAccountButton').html('<i class="fa-solid fa-circle-notch fa-spin"></i>')
    $.ajax({
        type: 'POST',
        beforeSend: function (request) {
            request.setRequestHeader("Authorization", key);
        },
        data: JSON.stringify({
            "product": "yearly"
        }),
        url: domain + '/paddle_create_payment_link',
        dataType: 'json',
        success: function (data) {
            chrome.tabs.create({url: data.link});
            // return false;
        }
    });
}

function showNews(data) {
    $('#news').show()
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
    $(document).delegate("#viewAddDomain", "click", addDomain);
    $(document).delegate("#viewReadButton", "click", getReadInbox);
    $(document).delegate("#viewUnreadButton", "click", getInbox);
    $(document).delegate("#viewSMSButton", "click", getSMSInbox);
    $(document).delegate("#viewSettingsButton", "click", getSettings);
    $(document).delegate("#viewAccountSettings", "click", getAccountSettings);
    $(document).delegate("#viewEditEmail", "click", getViewEditEmail);
    $(document).delegate("#viewValidateAction", "click", getViewValidateAction);
    $(document).delegate("#upgradeAccountButton", "click", upgradeAccount);

    // forms
    $(document).delegate("#updateEmail", "click", updateEmail);
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
    viewUnreadButton: true,
    viewSettingsButton: false,
    viewSMSButton: false,
    viewReadButton: false,

    viewInboxContainer: true,
    load: false
}

function setNavigationState(nav, navHighlight, showState) {
    // reset all handlers
    $('body').off()

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
