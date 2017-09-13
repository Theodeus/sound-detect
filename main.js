(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var _pitchfinder = require("pitchfinder");

var _pitchfinder2 = _interopRequireDefault(_pitchfinder);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

var detect = false;
var constraints = { audio: true, video: false };

navigator.mediaDevices.getUserMedia(constraints).then(function (mediaStream) {

    var context = new AudioContext();

    //this is where the users mic comes in
    var mediaStreamSource = context.createMediaStreamSource(mediaStream);

    //https://www.npmjs.com/package/pitchfinder
    var pitchFinder = new _pitchfinder2.default.AMDF({
        minFrequency: 75,
        maxFrequency: 1000
    });

    //this lets us jack into the audio stream at a rate defined by the first param
    //44100 / 2048 = roughly every 21.5ms
    //this is rather expensive, so don't keep it running when you don't need it..
    var scriptNode = context.createScriptProcessor(2048, 1, 1);

    scriptNode.onaudioprocess = function (event) {
        // if (detect) {
        // console.log(pitchFinder(event.inputBuffer.getChannelData(0)));
        document.getElementById("pitch").innerHTML = pitchFinder(event.inputBuffer.getChannelData(0));
        //it's a good idea to experiment with applying some kind of smoothing here,
        // like averaging three frames from when the first pitch is detected, or something like that
        // }
    };

    //route the audio for pitch detection
    mediaStreamSource.connect(scriptNode);
    scriptNode.connect(context.destination);

    //TEST EVENT HANDLERS
    document.onmousedown = function () {
        detect = true;
    };
    document.onmouseup = function () {
        detect = false;
    };

    //This is the gate based noise detection, way cheaper than the AMDF above
    //the threshold should probably be based on the inital user recording, to see how hot their input is..
    var chain1 = createAudioChain(context, 100, 10, 3);
    var chain2 = createAudioChain(context, 200, 10, 5);
    var chain3 = createAudioChain(context, 300, 10, 5);

    mediaStreamSource.connect(chain1.input);
    mediaStreamSource.connect(chain2.input);
    mediaStreamSource.connect(chain3.input);

    chain1.start();
    chain2.start();
    chain3.start();
}).catch(function (err) {
    console.log(err.name + ": " + err.message);
});

function createAudioChain(context, midFrequency, range, threshold) {

    var input = void 0;
    var currFilter = false;
    var prevFilter = false;
    var bgColor = void 0;

    for (var _i = 0; _i < 6; _i++) {
        prevFilter = currFilter;
        currFilter = context.createBiquadFilter();
        currFilter.type = "bandpass";
        currFilter.Q.value = 10 * range;
        currFilter.frequency.value = midFrequency;
        currFilter.gain.value = -64;
        if (prevFilter) {
            prevFilter.connect(currFilter);
        } else {
            input = currFilter;
        }
    }

    var gate = context.createAnalyser();
    gate.fftSize = 256;
    var bufferLength = gate.frequencyBinCount;
    var audioArray = new Uint8Array(bufferLength);

    var energy = 0;
    function gateInput() {
        gate.getByteFrequencyData(audioArray);
        energy = audioArray.reduce(function (a, b) {
            return a + b;
        });
        if (energy / bufferLength > threshold) {
            bgColor = "#ccffcc";
        } else {
            bgColor = "#cccccc";
        }
        draw();
        requestAnimationFrame(gateInput);
    }

    currFilter.connect(gate);

    /* VIZ */

    var canvas = document.createElement("canvas");
    var h2 = document.createElement("h2");
    h2.innerHTML = midFrequency;
    document.body.appendChild(h2);
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    var x = void 0,
        y = void 0,
        v = void 0,
        i = void 0,
        sliceWidth = void 0;
    function draw() {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgb(0, 0, 0)';
        ctx.beginPath();
        sliceWidth = canvas.width * 5 / bufferLength;
        x = 0;
        for (i = 0; i < bufferLength; i++) {
            v = audioArray[i] / 128.0;
            y = canvas.height - v * canvas.height / 2;
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

    var animFrame = void 0;
    return {
        input: input,
        output: gate,
        start: function start(_) {
            animFrame = requestAnimationFrame(gateInput);
        },
        stop: function stop(_) {
            cancelAnimationFrame(animFrame);
        }
    };
}

},{"pitchfinder":2}],2:[function(require,module,exports){
module.exports = require("./lib");
},{"./lib":6}],3:[function(require,module,exports){
"use strict";

var DEFAULT_MIN_FREQUENCY = 82;
var DEFAULT_MAX_FREQUENCY = 1000;
var DEFAULT_RATIO = 5;
var DEFAULT_SENSITIVITY = 0.1;
var DEFAULT_SAMPLE_RATE = 44100;

module.exports = function () {
  var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var sampleRate = config.sampleRate || DEFAULT_SAMPLE_RATE;
  var minFrequency = config.minFrequency || DEFAULT_MIN_FREQUENCY;
  var maxFrequency = config.maxFrequency || DEFAULT_MAX_FREQUENCY;
  var sensitivity = config.sensitivity || DEFAULT_SENSITIVITY;
  var ratio = config.ratio || DEFAULT_RATIO;
  var amd = [];
  var maxPeriod = Math.round(sampleRate / minFrequency + 0.5);
  var minPeriod = Math.round(sampleRate / maxFrequency + 0.5);

  return function AMDFDetector(float32AudioBuffer) {
    "use strict";

    var maxShift = float32AudioBuffer.length;

    var t = 0;
    var minval = Infinity;
    var maxval = -Infinity;
    var frames1 = undefined,
        frames2 = undefined,
        calcSub = undefined,
        i = undefined,
        j = undefined,
        u = undefined,
        aux1 = undefined,
        aux2 = undefined;

    // Find the average magnitude difference for each possible period offset.
    for (i = 0; i < maxShift; i++) {
      if (minPeriod <= i && i <= maxPeriod) {
        for (aux1 = 0, aux2 = i, t = 0, frames1 = [], frames2 = []; aux1 < maxShift - i; t++, aux2++, aux1++) {
          frames1[t] = float32AudioBuffer[aux1];
          frames2[t] = float32AudioBuffer[aux2];
        }

        // Take the difference between these frames.
        var frameLength = frames1.length;
        calcSub = [];
        for (u = 0; u < frameLength; u++) {
          calcSub[u] = frames1[u] - frames2[u];
        }

        // Sum the differences.
        var summation = 0;
        for (u = 0; u < frameLength; u++) {
          summation += Math.abs(calcSub[u]);
        }
        amd[i] = summation;
      }
    }

    for (j = minPeriod; j < maxPeriod; j++) {
      if (amd[j] < minval) minval = amd[j];
      if (amd[j] > maxval) maxval = amd[j];
    }

    var cutoff = Math.round(sensitivity * (maxval - minval) + minval);
    for (j = minPeriod; j <= maxPeriod && amd[j] > cutoff; j++);

    var search_length = minPeriod / 2;
    minval = amd[j];
    var minpos = j;
    for (i = j - 1; i < j + search_length && i <= maxPeriod; i++) {
      if (amd[i] < minval) {
        minval = amd[i];
        minpos = i;
      }
    }

    if (Math.round(amd[minpos] * ratio) < maxval) {
      return sampleRate / minpos;
    } else {
      return null;
    }
  };
};
},{}],4:[function(require,module,exports){
"use strict";

var DEFAULT_SAMPLE_RATE = 44100;
var MAX_FLWT_LEVELS = 6;
var MAX_F = 3000;
var DIFFERENCE_LEVELS_N = 3;
var MAXIMA_THRESHOLD_RATIO = 0.75;

module.exports = function () {
  var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var sampleRate = config.sampleRate || DEFAULT_SAMPLE_RATE;

  return function DynamicWaveletDetector(float32AudioBuffer) {
    "use strict";

    var mins = [];
    var maxs = [];
    var bufferLength = float32AudioBuffer.length;

    var freq = null;
    var theDC = 0;
    var minValue = 0;
    var maxValue = 0;

    // Compute max amplitude, amplitude threshold, and the DC.
    for (var i = 0; i < bufferLength; i++) {
      var sample = float32AudioBuffer[i];
      theDC = theDC + sample;
      maxValue = Math.max(maxValue, sample);
      minValue = Math.min(minValue, sample);
    }

    theDC /= bufferLength;
    minValue -= theDC;
    maxValue -= theDC;
    var amplitudeMax = maxValue > -1 * minValue ? maxValue : -1 * minValue;
    var amplitudeThreshold = amplitudeMax * MAXIMA_THRESHOLD_RATIO;

    // levels, start without downsampling...
    var curLevel = 0;
    var curModeDistance = -1;
    var curSamNb = float32AudioBuffer.length;
    var delta = undefined,
        nbMaxs = undefined,
        nbMins = undefined;

    // Search:
    while (true) {
      delta = ~ ~(sampleRate / (Math.pow(2, curLevel) * MAX_F));
      if (curSamNb < 2) break;

      var dv = undefined;
      var previousDV = -1000;
      var lastMinIndex = -1000000;
      var lastMaxIndex = -1000000;
      var findMax = false;
      var findMin = false;

      nbMins = 0;
      nbMaxs = 0;

      for (var i = 2; i < curSamNb; i++) {
        var si = float32AudioBuffer[i] - theDC;
        var si1 = float32AudioBuffer[i - 1] - theDC;

        if (si1 <= 0 && si > 0) findMax = true;
        if (si1 >= 0 && si < 0) findMin = true;

        // min or max ?
        dv = si - si1;

        if (previousDV > -1000) {
          if (findMin && previousDV < 0 && dv >= 0) {
            // minimum
            if (Math.abs(si) >= amplitudeThreshold) {
              if (i > lastMinIndex + delta) {
                mins[nbMins++] = i;
                lastMinIndex = i;
                findMin = false;
              }
            }
          }

          if (findMax && previousDV > 0 && dv <= 0) {
            // maximum
            if (Math.abs(si) >= amplitudeThreshold) {
              if (i > lastMaxIndex + delta) {
                maxs[nbMaxs++] = i;
                lastMaxIndex = i;
                findMax = false;
              }
            }
          }
        }
        previousDV = dv;
      }

      if (nbMins === 0 && nbMaxs === 0) {
        // No best distance found!
        break;
      }

      var d = undefined;
      var distances = [];

      for (var i = 0; i < curSamNb; i++) {
        distances[i] = 0;
      }

      for (var i = 0; i < nbMins; i++) {
        for (var j = 1; j < DIFFERENCE_LEVELS_N; j++) {
          if (i + j < nbMins) {
            d = Math.abs(mins[i] - mins[i + j]);
            distances[d] += 1;
          }
        }
      }

      var bestDistance = -1;
      var bestValue = -1;

      for (var i = 0; i < curSamNb; i++) {
        var summed = 0;
        for (var j = -1 * delta; j <= delta; j++) {
          if (i + j >= 0 && i + j < curSamNb) {
            summed += distances[i + j];
          }
        }

        if (summed === bestValue) {
          if (i === 2 * bestDistance) {
            bestDistance = i;
          }
        } else if (summed > bestValue) {
          bestValue = summed;
          bestDistance = i;
        }
      }

      // averaging
      var distAvg = 0;
      var nbDists = 0;
      for (var j = -delta; j <= delta; j++) {
        if (bestDistance + j >= 0 && bestDistance + j < bufferLength) {
          var nbDist = distances[bestDistance + j];
          if (nbDist > 0) {
            nbDists += nbDist;
            distAvg += (bestDistance + j) * nbDist;
          }
        }
      }

      // This is our mode distance.
      distAvg /= nbDists;

      // Continue the levels?
      if (curModeDistance > -1) {
        if (Math.abs(distAvg * 2 - curModeDistance) <= 2 * delta) {
          // two consecutive similar mode distances : ok !
          freq = sampleRate / (Math.pow(2, curLevel - 1) * curModeDistance);
          break;
        }
      }

      // not similar, continue next level;
      curModeDistance = distAvg;

      curLevel++;
      if (curLevel >= MAX_FLWT_LEVELS || curSamNb < 2) {
        break;
      }

      //do not modify original audio buffer, make a copy buffer, if
      //downsampling is needed (only once).
      var newFloat32AudioBuffer = float32AudioBuffer.subarray(0);
      if (curSamNb === distances.length) {
        newFloat32AudioBuffer = new Float32Array(curSamNb / 2);
      }
      for (var i = 0; i < curSamNb / 2; i++) {
        newFloat32AudioBuffer[i] = (float32AudioBuffer[2 * i] + float32AudioBuffer[2 * i + 1]) / 2;
      }
      float32AudioBuffer = newFloat32AudioBuffer;
      curSamNb /= 2;
    }

    return freq;
  };
};
},{}],5:[function(require,module,exports){
"use strict";

var DEFAULT_THRESHOLD = 0.10;
var DEFAULT_SAMPLE_RATE = 44100;
var DEFAULT_PROBABILITY_THRESHOLD = 0.1;

module.exports = function () {
  var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var threshold = config.threshold || DEFAULT_THRESHOLD;
  var sampleRate = config.sampleRate || DEFAULT_SAMPLE_RATE;
  var probabilityThreshold = config.probabilityThreshold || DEFAULT_PROBABILITY_THRESHOLD;

  return function YINDetector(float32AudioBuffer) {
    "use strict";

    // Set buffer size to the highest power of two below the provided buffer's length.
    var bufferSize = undefined;
    for (bufferSize = 1; bufferSize < float32AudioBuffer.length; bufferSize *= 2);
    bufferSize /= 2;

    // Set up the yinBuffer as described in step one of the YIN paper.
    var yinBufferLength = bufferSize / 2;
    var yinBuffer = new Float32Array(yinBufferLength);

    var probability = undefined,
        tau = undefined;

    // Compute the difference function as described in step 2 of the YIN paper.
    for (var t = 0; t < yinBufferLength; t++) {
      yinBuffer[t] = 0;
    }
    for (var t = 1; t < yinBufferLength; t++) {
      for (var i = 0; i < yinBufferLength; i++) {
        var delta = float32AudioBuffer[i] - float32AudioBuffer[i + t];
        yinBuffer[t] += delta * delta;
      }
    }

    // Compute the cumulative mean normalized difference as described in step 3 of the paper.
    yinBuffer[0] = 1;
    yinBuffer[1] = 1;
    var runningSum = 0;
    for (var t = 1; t < yinBufferLength; t++) {
      runningSum += yinBuffer[t];
      yinBuffer[t] *= t / runningSum;
    }

    // Compute the absolute threshold as described in step 4 of the paper.
    // Since the first two positions in the array are 1,
    // we can start at the third position.
    for (tau = 2; tau < yinBufferLength; tau++) {
      if (yinBuffer[tau] < threshold) {
        while (tau + 1 < yinBufferLength && yinBuffer[tau + 1] < yinBuffer[tau]) {
          tau++;
        }
        // found tau, exit loop and return
        // store the probability
        // From the YIN paper: The threshold determines the list of
        // candidates admitted to the set, and can be interpreted as the
        // proportion of aperiodic power tolerated
        // within a periodic signal.
        //
        // Since we want the periodicity and and not aperiodicity:
        // periodicity = 1 - aperiodicity
        probability = 1 - yinBuffer[tau];
        break;
      }
    }

    // if no pitch found, return null.
    if (tau == yinBufferLength || yinBuffer[tau] >= threshold) {
      return null;
    }

    // If probability too low, return -1.
    if (probability < probabilityThreshold) {
      return null;
    }

    /**
     * Implements step 5 of the AUBIO_YIN paper. It refines the estimated tau
     * value using parabolic interpolation. This is needed to detect higher
     * frequencies more precisely. See http://fizyka.umk.pl/nrbook/c10-2.pdf and
     * for more background
     * http://fedc.wiwi.hu-berlin.de/xplore/tutorials/xegbohtmlnode62.html
     */
    var betterTau = undefined,
        x0 = undefined,
        x2 = undefined;
    if (tau < 1) {
      x0 = tau;
    } else {
      x0 = tau - 1;
    }
    if (tau + 1 < yinBufferLength) {
      x2 = tau + 1;
    } else {
      x2 = tau;
    }
    if (x0 === tau) {
      if (yinBuffer[tau] <= yinBuffer[x2]) {
        betterTau = tau;
      } else {
        betterTau = x2;
      }
    } else if (x2 === tau) {
      if (yinBuffer[tau] <= yinBuffer[x0]) {
        betterTau = tau;
      } else {
        betterTau = x0;
      }
    } else {
      var s0 = yinBuffer[x0];
      var s1 = yinBuffer[tau];
      var s2 = yinBuffer[x2];
      // fixed AUBIO implementation, thanks to Karl Helgason:
      // (2.0f * s1 - s2 - s0) was incorrectly multiplied with -1
      betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    return sampleRate / betterTau;
  };
};
},{}],6:[function(require,module,exports){
"use strict";

var AMDF = require("./detectors/amdf");
var YIN = require("./detectors/yin");
var DynamicWavelet = require("./detectors/dynamic_wavelet");
// const FastYIN = require("./detectors/fast_yin");
// const Macleod = require("./detectors/macleod");

var frequencies = require("./tools/frequencies");
var notes = require("./tools/notes");

module.exports = {
  AMDF: AMDF,
  YIN: YIN,
  DynamicWavelet: DynamicWavelet,

  frequencies: frequencies,
  notes: notes
};
},{"./detectors/amdf":3,"./detectors/dynamic_wavelet":4,"./detectors/yin":5,"./tools/frequencies":7,"./tools/notes":8}],7:[function(require,module,exports){
"use strict";

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; })();

var DEFAULT_TEMPO = 120;
var DEFAULT_QUANTIZATION = 4;
var DEFAULT_SAMPLE_RATE = 44100;

function pitchConsensus(detectors, chunk) {
  var pitches = detectors.map(function (fn) {
    return fn(chunk);
  }).filter(Boolean).sort(function (a, b) {
    return a < b ? -1 : 1;
  });

  // In the case of one pitch, return it.
  if (pitches.length === 1) {
    return pitches[0];

    // In the case of two pitches, return the geometric mean if they
    // are close to each other, and the lower pitch otherwise.
  } else if (pitches.length === 2) {
      var _pitches = _slicedToArray(pitches, 2);

      var first = _pitches[0];
      var second = _pitches[1];

      return first * 2 > second ? Math.sqrt(first * second) : first;

      // In the case of three or more pitches, filter away the extremes
      // if they are very extreme, then take the geometric mean.
    } else {
        var first = pitches[0];
        var second = pitches[1];
        var secondToLast = pitches[pitches.length - 2];
        var last = pitches[pitches.length - 1];

        var filtered1 = first * 2 > second ? pitches : pitches.slice(1);
        var filtered2 = secondToLast * 2 > last ? filtered1 : filtered1.slice(0, -1);
        return Math.pow(filtered2.reduce(function (t, p) {
          return t * p;
        }, 1), 1 / filtered2.length);
      }
}

module.exports = function (detector, float32AudioBuffer) {
  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  var tempo = options.tempo || DEFAULT_TEMPO;
  var quantization = options.quantization || DEFAULT_QUANTIZATION;
  var sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;

  var bufferLength = float32AudioBuffer.length;
  var chunkSize = Math.round(sampleRate * 60 / (quantization * tempo));

  var getPitch = undefined;
  if (Array.isArray(detector)) {
    getPitch = pitchConsensus.bind(null, detector);
  } else {
    getPitch = detector;
  }

  var pitches = [];
  for (var i = 0, max = bufferLength - chunkSize; i <= max; i += chunkSize) {
    var chunk = float32AudioBuffer.slice(i, i + chunkSize);
    var pitch = getPitch(chunk);
    pitches.push(pitch);
  }

  return pitches;
};
},{}],8:[function(require,module,exports){
"use strict";

// const teoria = require("teoria");
// const frequencies = require("./frequencies");

// module.exports = function(detector, float32AudioBuffer, options) {
//   // const key = options.key || null;
//   // const mode = (key && options.mode) || null;
//   // const merge = options.merge || false;

//   const freqs = frequencies(detector, float32AudioBuffer, options);
//   return freqs.map(freq => freq ? teoria.note.fromFrequency(freq).note : null);
// };
},{}]},{},[1]);
