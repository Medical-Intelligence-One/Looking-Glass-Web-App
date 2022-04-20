

//generic function to hide the toast alert
function hideToastAlert() {
    var myAlert = $("#mi1-toast")[0];
    if (myAlert) {
        var bsAlert = new bootstrap.Toast(myAlert);
        bsAlert.hide();
    }
}

//generic function to show the toast alert
function showToastAlert(title, message, position) {
    $("#toast-title").text(title);
    $("#toast-message").text(message);
    var myClass;
    switch (position) {
        case "top-left":
            myClass = "top-0 start-0";
            break;
        case "top-center":
            myClass = "top-0 start-50 translate-middle-x";
            break;
        case "top-right":
            myClass = "top-0 end-0";
            break;
        case "middle-left":
            myClass = "top-50 start-0 translate-middle-y";
            break;
        case "middle-center":
            myClass = "top-50 start-50 translate-middle";
            break;
        case "middle-right":
            myClass = "top-50 end-0 translate-middle-y";
            break;
        case "bottom-left":
            myClass = "bottom-0 start-0";
            break;
        case "bottom-center":
            myClass = "bottom-0 start-50 translate-middle-x";
            break;
        case "bottom-right":
            myClass = "bottom-0 end-0";
            break;
        default:
    }
    $("#mi1-toast").attr("class", "toast position-fixed p-3 " + myClass);
    $('.toast-header').toggleClass("d-none", title.length == 0);
    $('toast-body').toggleClass("d-none", message.length == 0);
    var myAlert = $("#mi1-toast")[0];
    if (myAlert) {
        var bsAlert = new bootstrap.Toast(myAlert);
        bsAlert.show();
    }
}
