// Commented out variables below are filled in in the PHP code before this file is loaded.
//var panelCode = "<?php echo $panelCode?>";
//var panelStatusUrl = "<?php echo $panelStatusUrl?>";
var timeout_ids = [];
var next_slide_timeout_id;
//var ctaClickUrl = "<?php echo $ctaClickUrl; ?>";
//var flashCountUrl = "<?php echo $flashCountUrl; ?>";
//var backClickUrl = "<?php echo $backClickUrl; ?>";
//var panelActivityUrl = "<?php echo $panelActivityUrl; ?>";
//// Current uuid for the advertisement
//var current_uuid = "<?php echo $firstUuid; ?>";
//var previous_uuid = "<?php echo $firstUuid; ?>";
var current_div = $("div[data-uuid='" + current_uuid +"']")[0];
var current_filetype = current_div.getAttribute('data-filetype');
var current_src = current_div.children[0].src;
var current_interval = current_div.dataset.interval;

//// For ads with CTA url
//var current_cta_url = "<?php echo $firstCtaUrl; ?>";
//var ctaUrlClickUrl = "<?php echo $ctaUrlClickUrl?>";

// If set to false, flash count won't be sent to server.
// Used while skipping geo targeted ads
var send_flash_count = true;

// Details for panel activity and battery status
var deviceIp = '0.0.0.0'; // Default. 
var batteryCharging = 2; // 0 = No, 1 = Yes, 2 = Unknown
var batteryLevel = 0.00;

var isScreenOn = 1; // First assume the screen is on at startup.

// GPS data
var lat = 0;
var lng = 0;

// Demographics data
var mlResult = null;
var audienceCount = null; // unknown
var audienceGender = ''; // unknown
var audienceAge = null; // unknown
// Variables for ML
var forwardTimes = [];
var predictedAges = [];

// Get IP address of this device

setTimeout(function(){
    $.getJSON('https://api.ipify.org/?format=json', function(data){
            deviceIp = data.ip;
            });
},5000);

/**
 * Calculate straight line distance between two sets of lat + lng in Meters
 * Copied from SO: https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula?page=1&tab=votes#tab-top
 * @param lat1
 * @param lng1
 * @param lat2
 * @param lng2
 * @returns {number}
 */
function getDistanceFromLatLngInMeters(lat1, lng1, lat2, lng2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLng = deg2rad(lng2-lng1);
    var a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLng/2) * Math.sin(dLng/2)
    ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c; // Distance in km
    d = Math.round(d * 1000); // Distance in Meters
    return d;
}

/**
 * Convert Degree to Rad
 * @param deg
 * @returns {number}
 */
function deg2rad(deg) {
    return deg * (Math.PI/180)
}

function showPosition(position) {
    lat = position.coords.latitude;
    lng = position.coords.longitude;
}
function errorPosition(err){
    console.log("Error in geolocation:");
    console.log("Error code: " + err.code);
    console.log("Error message: " + err.message);
    // Send error report to server
    $.getJSON(positionErrorUrl,
        {
            panel_code:      panelCode,
            ip:              deviceIp,
            err_code:        err.code,
            err_msg:         err.message
        },
        function(data){
            //console.log(data);
        });
}

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition, errorPosition, {maximumAge: 5000, timeout: 30000, enableHighAccuracy: true});
    } else {
        console.log("Geolocation is not supported by this browser.");
    }
}


function stopAllTimeouts(){
    for(var i = 0; i < timeout_ids.length; i++){
        clearTimeout(timeout_ids[i]);
    }
}

// Check for changes in screen on status.
setInterval(function(){
    if (typeof injectedJsObject !== "undefined") {
        isScreenOn = Number(injectedJsObject.getScreenStatus());
    }
}, 5000);

function playVideo(video_tag){
    //First assume this is not playing.
    video_tag.dataset.playing = 0;
    video_tag.load();
    var playPromise = video_tag.play();
    if (playPromise !== undefined) {
        playPromise.then(function() {
            // Play started.
            //console.log("Video started");
            //console.log("Starting slide timeouts");
            clearTimeout(next_slide_timeout_id);
            next_slide_timeout_id = setTimeout(function(){
                //console.log("Sliding to next");
                $("#ds-carousel").carousel('next');
            }, current_interval);
            // Set playing to 1
            video_tag.dataset.playing = 1;
        }).catch(function(error) {
            // Play failed.
            console.log("Video play failed. " + error);
        });
    }
}

function stopVideo(video_tag){
    var src_temp = video_tag.src;
    video_tag.removeAttribute('src');
    video_tag.load();
    video_tag.src = src_temp;
}

// CTA click or the main image click.
function cta_click(){
    // Clear all timeouts set earlier. The user may click many times on this button.
    stopAllTimeouts();
    // Stop the manual slideshow timer.
    clearTimeout(next_slide_timeout_id);

    // Redirect to cta url if it is present.
    if (current_cta_url != '') {
        $.redirect(ctaUrlClickUrl, 
                {
                    advertisement_id:    current_uuid,
                    panel_code:      panelCode,
                    lat:             lat,
                    lng:             lng,
                    is_screen_on:    isScreenOn,
                    audience_count:  audienceCount,
                    audience_gender: audienceGender,
                    audience_age:    audienceAge
                }, "POST");
    }else{
        // Get CTA Click to server
        $.getJSON(ctaClickUrl, 
                {
                    advertisement_id: current_uuid,
                    panel_code:       panelCode,
                    lat:              lat,
                    lng:              lng,
                    is_screen_on:     isScreenOn,
                    audience_count:   audienceCount,
                    audience_gender:  audienceGender,
                    audience_age:     audienceAge
                },
                function(data){
                });
        // Call lightbox (featherlight)
        $.featherlight($("#" + current_uuid), {
            closeOnClick: false,
            openSpeed: 700,
            closeSpeed: 600,
            afterClose: function(){
                stopAllTimeouts();
            }
        });
        // Close lightbox after 18 seconds
        timeout_ids.push(setTimeout(function(){
            var current_lightbox = $.featherlight.current();
            if (current_lightbox != null) {
                current_lightbox.close();
            }
        }, 18000)); //18000 = 18 seconds.
        // Continue slideshow after 20 seconds
        next_slide_timeout_id = setTimeout(function(){
            $("#ds-carousel").carousel('next');
        }, 20000); //20000 = 20 seconds.
    }
}

/*
// interpolate gender predictions over giver number of frames
// to make the displayed age more stable
function interpolateAgePredictions(age) {
    predictedAges = [age].concat(predictedAges).slice(0, 30);
    const avgPredictedAge = predictedAges.reduce((total, a) => total + a) / predictedAges.length;
    return avgPredictedAge;
}

// Called when the video element is ready.
// Start ML detection
async function onPlay() {
console.log("Running ML inside onPlay");
const videoEl = $('#inputVideo').get(0);

if(videoEl.paused || videoEl.ended || !isFaceDetectionModelLoaded()){
return setTimeout(() => onPlay());
}

const options = getFaceDetectorOptions();

const ts = Date.now();

const result = await faceapi.detectSingleFace(videoEl, options)
.withAgeAndGender();
//const result = await faceapi.detectAllFaces(videoEl, options)
//.withAgeAndGender();

if (result) {
// interpolate gender predictions over last 30 frames
// to make the displayed age more stable
age = result.age;
const interpolatedAge = interpolateAgePredictions(age);
updateResults(result);
}
// Run detection every 30 seconds
setTimeout(() => onPlay(), 30000);
}

// Called when the document is ready.
// Load models and weights
async function run() {
// load face detection and face expression recognition models
await changeFaceDetector(TINY_FACE_DETECTOR);
await faceapi.nets.ageGenderNet.load('/js/weights/');
// try to access users webcam and stream the images
// to the video element
const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
const videoEl = $('#inputVideo').get(0);
videoEl.srcObject = stream;
}

function updateResults(aCount, aGender, aAge) {
function updateResults(result) {
audienceCount = 1;
audienceGender = result.gender;
if (audienceGender === 'female') {
audienceGender = 'f';
}else if(audienceGender === 'male'){
audienceGender = 'm';
}else{
audienceGender = '';
}

audienceAge = result.age;
console.log("ML Results updated");
}
*/
// When the document is ready
$(document).ready(function(){
    // Test code for pDOOH
    // End of test code for pDOOH

    // Start Bootstrap carousel
    var carousel_object = $("#ds-carousel").carousel({interval: false});
    $("#ds-carousel").carousel('pause');
    // Manual timeout to start the slide show.
    clearTimeout(next_slide_timeout_id);
    next_slide_timeout_id = setTimeout(function(){
        //console.log("Sliding to next");
        $("#ds-carousel").carousel('next');
    }, current_interval);
    // # end of manual timeout.
    // Play the first video if it is a video
    current_filetype = current_div.getAttribute('data-filetype');
    // If it is MP4
    if(current_filetype.includes("video")){
        //current_div.children[0].currentTime = 0;
        //current_div.children[0].play();
        playVideo(current_div.children[0]);
    }

    // Detect slide event & update current ad uuid
    $('#ds-carousel').on('slid.bs.carousel', function (e) {
        // Make the previous target
        $("#ds-carousel").carousel('pause');
        var slideIndexPrev = $(this).find('.active').index();
        var slideIndexCurrent = $(e.relatedTarget).index();

        // Check first and last slide
        if(slideIndexCurrent === 0){
            console.log('first slide')
            console.log('number of slides:',$(e.relatedTarget).siblings().length + 1)
        }else if(slideIndexCurrent === $(e.relatedTarget).siblings().length){
            console.log('last slide')
        }
        
        var slideIndexNext = $(e.relatedTarget).next().index();
        previous_uuid = $(this).find('.active').attr('data-uuid');
        current_uuid = $(e.relatedTarget).attr('data-uuid');
        current_cta_url = $("#"+current_uuid).attr('data-ctaurl');
        if (current_cta_url != '') {
            current_cta_url = encodeURI(current_cta_url);
        }
        current_interval = $(e.relatedTarget).attr('data-interval');

        // Check if this is animated
        t=new Date().getTime();
        current_div = $("div[data-uuid='" + current_uuid +"']")[0];
        current_filetype = current_div.getAttribute('data-filetype');
        current_src = current_div.children[0].src;
        // Pause / stop the prev video if any.
        previous_div = $("div[data-uuid='" + previous_uuid +"']")[0];
        previous_filetype = previous_div.getAttribute('data-filetype');
        // Call pause only if it is video AND is playing.
        if (previous_filetype.includes("video")) {
            stopVideo(previous_div.children[0]);
        }
        // Make the previous div's first child visible incase it was hidden due to geo-targeting
        previous_div.children[0].style.visibility = "visible";

        // If current slide is MP4
        if(current_filetype.includes("video")){
            playVideo(current_div.children[0]);
        }
        clearTimeout(next_slide_timeout_id);
        next_slide_timeout_id = setTimeout(function(){
            //console.log("Sliding to next");
            $("#ds-carousel").carousel('next');
        }, current_interval);
        /*
         Start of code to skip geo targeted ads if not within radius
          */
        if ( $(e.relatedTarget).attr('data-gf') === '1' ){
            // Don't show the ad if current lat & lng are zero
            if (lat > 0 && lng > 0){
                dist = getDistanceFromLatLngInMeters(
                    lat,lng, $(e.relatedTarget).attr('data-lat'), $(e.relatedTarget).attr('data-lng')
                );
                radius = $(e.relatedTarget).attr('data-gf-radius');
                if (dist > radius){
                    send_flash_count = false;
                    target = $(e.relatedTarget);
                    // target.hide();
                    current_div.children[0].style.visibility = "hidden";
                    clearTimeout(next_slide_timeout_id);
                    (async () => {
                        await $("#ds-carousel").carousel('next');
                    })();
                }
            }else{
                // Skip this ad. This is geo targeted and we don't have current location.
                send_flash_count = false;
                target = $(e.relatedTarget);
                // target.hide();
                current_div.children[0].style.visibility = "hidden";
                clearTimeout(next_slide_timeout_id);
                (async () => {
                    await $("#ds-carousel").carousel('next');
                })();

            }
        }else{
            // Set to true for next ad.
            send_flash_count = true;
        }
        /*
         End of code to skip geo targeted ads if not within radius
          */

        // send flash count if the ad is not being skipped.
        if (send_flash_count){
            // Get flash count to server
            $.getJSON(flashCountUrl,
                {
                    advertisement_id: current_uuid,
                    panel_code:       panelCode,
                    lat:              lat,
                    lng:              lng,
                    is_screen_on:     isScreenOn,
                    audience_count:   audienceCount,
                    audience_gender:  audienceGender,
                    audience_age:     audienceAge
                },
                function(data){
                    //console.log(data);
                });
        }
    });

    // Back button clicked
    $("#back_button").click(function(){
        //console.log("Back Button clicked");
        // Get Back Click to server
        $.getJSON(backClickUrl, 
                {
                    advertisement_id: previous_uuid,
                    panel_code:       panelCode,
                    lat:              lat,
                    lng:              lng,
                    is_screen_on:     isScreenOn,
                    audience_count:   audienceCount,
                    audience_gender:  audienceGender,
                    audience_age:     audienceAge

                },
                function(data){
                    //console.log(data);
                });
    });

    // Main image clicked
    $(".carousel-inner").click(function(e){
        disable_cta = $("#"+current_uuid).attr('data-disable-cta');

        // Check if send_flash_count is set to true. This is for geo-fencing.
        if (send_flash_count){
            // Check if CTA is disabled. This is for ads without cta image. Display only.
            if (disable_cta == 0){
                cta_click();
            }
        }
    });


    // Update panel status to server
    setInterval(function(){
        $.getJSON(panelActivityUrl, 
                {
                    panel_code:      panelCode,
                    ip:              deviceIp,
                    charging:        batteryCharging,
                    batt:            batteryLevel,
                    lat:             lat,
                    lng:             lng,
                    is_screen_on:    isScreenOn,
                    audience_count:  audienceCount,
                    audience_gender: audienceGender,
                    audience_age:    audienceAge
                },
                function(data){
                    //console.log(data);
                });
    }, 20000);

    // Get location every 5sec
    setInterval(function(){
        getLocation();
    }, 5000);

    //run();
    //var inputVideoElement = document.getElementById("inputVideo");
    //inputVideoElement.play();
});

