import Pitchfinder from "pitchfinder";


/*
    The basic idea is this
    - have the user record their noises of choice and do pitch detection while doing so.
    - route the input to n audio chains, where n is the number of noises we're looking for,
        consisting of a series of filters and finally a gate
    - the filters should cut everything above/below the pitch detected for a specific noise, +- a range to allow
        some wobbling
    - the gates aren't really gates.. they're functions checking if the signal reaches a certain level or not,
        if it does the gate triggers and we can assume that the noise was heard
    - if multiple "gates" triggers we could compare the levels between them to choose noise, or consider that
        a combination that points to a specific noise?
    - actual noise (audio without pitch, such as hisses) should trigger multiple gates, so that might be a
        good idea
*/

/*
    POSSIBLE (untested) ALTERNATIVES
        - https://www.codeproject.com/Articles/206507/Duplicates-detector-via-audio-fingerprinting
        - https://en.wikipedia.org/wiki/Dynamic_time_warping (https://www.npmjs.com/package/dtw)
*/

let detect = false;
var constraints = { audio: true, video: false };

navigator.mediaDevices.getUserMedia(constraints).then(function(mediaStream) {

    const context = new AudioContext();

    //this is where the users mic comes in
    let mediaStreamSource = context.createMediaStreamSource(mediaStream);

    //https://www.npmjs.com/package/pitchfinder
    let pitchFinder = new Pitchfinder.AMDF({
        minFrequency: 75,
        maxFrequency: 1000
    });

    //this lets us jack into the audio stream at a rate defined by the first param
    //44100 / 2048 = roughly every 21.5ms
    //this is rather expensive, so don't keep it running when you don't need it..
    let scriptNode = context.createScriptProcessor(2048, 1, 1);

    scriptNode.onaudioprocess = function(event) {
        if (detect) {
            console.log(pitchFinder(event.inputBuffer.getChannelData(0)));

            //it's a good idea to experiment with applying some kind of smoothing here,
            // like averaging three frames from when the first pitch is detected, or something like that
        }
    }

    //route the audio for pitch detection
    mediaStreamSource.connect(scriptNode);
    scriptNode.connect(context.destination);

    //TEST EVENT HANDLERS
    document.onmousedown = function() {
        detect = true;
    }
    document.onmouseup = function() {
        detect = false;
    }



    //This is the gate based noise detection, way cheaper than the AMDF above
    //the threshold should probably be based on the inital user recording, to see how hot their input is..
    let chain1 = createAudioChain(context, 100, 10, 3);
    let chain2 = createAudioChain(context, 200, 10, 5);
    let chain3 = createAudioChain(context, 300, 10, 5);

    mediaStreamSource.connect(chain1.input);
    mediaStreamSource.connect(chain2.input);
    mediaStreamSource.connect(chain3.input);

    chain1.start();
    chain2.start();
    chain3.start();
}).catch(function(err) {
    console.log(err.name + ": " + err.message);
});


function createAudioChain(context, midFrequency, range, threshold) {
    let filter1 = context.createBiquadFilter();
    filter1.type = "bandpass";
    filter1.Q.value = 10 * range;
    filter1.frequency.value = midFrequency;
    filter1.gain.value = -64;
    let filter2 = context.createBiquadFilter();
    filter2.type = "bandpass";
    filter2.Q.value = 10 * range;
    filter2.frequency.value = midFrequency;
    filter2.gain.value = -64;
    let filter3 = context.createBiquadFilter();
    filter3.type = "bandpass";
    filter3.Q.value = 10 * range;
    filter3.frequency.value = midFrequency;
    filter3.gain.value = -64;
    let filter4 = context.createBiquadFilter();
    filter4.type = "bandpass";
    filter4.Q.value = 10 * range;
    filter4.frequency.value = midFrequency;
    filter4.gain.value = -64;

    let gate = context.createAnalyser();
    gate.fftSize = 256;
    let bufferLength = gate.frequencyBinCount;
    let audioArray = new Uint8Array(bufferLength);

    let energy = 0;
    function gateInput() {
        gate.getByteFrequencyData(audioArray);
        energy = audioArray.reduce((a, b) => a + b);
        if (energy / bufferLength > threshold) {
            console.log(midFrequency, "triggered with an energy value of", energy / bufferLength);
        }
        draw();
        requestAnimationFrame(gateInput);
    }

    filter1.connect(filter2);
    filter2.connect(filter3);
    filter3.connect(filter4);
    filter4.connect(gate);


    /* VIZ */

    let canvas = document.createElement("canvas");
    let h2 = document.createElement("h2");
    h2.innerHTML = midFrequency;
    document.body.appendChild(h2);
    document.body.appendChild(canvas);
    let ctx = canvas.getContext("2d");

    let x, y, v, i, sliceWidth;
    function draw() {
        ctx.fillStyle = 'rgb(200, 200, 200)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgb(0, 0, 0)';
        ctx.beginPath();
        sliceWidth = canvas.width * 1.0 / bufferLength;
        x = 0;
        for (i = 0; i < bufferLength; i++) {
            v = audioArray[i] / 128.0;
            y = canvas.height - (v * canvas.height / 2);
            if (i === 0) {
             ctx.moveTo(x, y);
            } else {
             ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.stroke();
    }

    /* VIZ END */

    let animFrame;
    return {
        input: filter1,
        output: gate,
        start: _ => {
            animFrame = requestAnimationFrame(gateInput);
        },
        stop: _ => {
            cancelAnimationFrame(animFrame)
        }
    }
}
