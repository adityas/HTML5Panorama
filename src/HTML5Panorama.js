/**
 * Modified by: Luca Rainone
 * - modulirized
 * - crossbrowser fixes (tested on FF, Chrome, Android 4.4, Windows Mobile)
 * - inertia logic
 *
 ***/

/***
 * Author: Aditya Sankar
 * Note: This code is provided "as-is" under a FreeBSD style (simplified) license. Please refer to
 *      http://www.cs.washington.edu/homes/aditya/files/photos/pano/license.txt for more information.
 ***/

/**
 * Basic Usage :

 HTML5Panorama({
     canvas  : "my_canvas_id", // id of canvas element or DOM Element
     src     : "http://homes.cs.washington.edu/~aditya/files/photos/pano/mountains.jpeg", // source of image
     num_slices : 500 // not mandatory. default "auto"
 });

 *
 * Advanced Usage :
 *

 HTML5Panorama({
     canvas                       : document.getElementById("my_canvas_id"), // DOM Canvas Element
     src                          : "http://homes.cs.washington.edu/~aditya/files/photos/pano/mountains.jpeg",
     initialSpeed                 : 10, // move the image on load
     num_slices                   : ('ontouchstart' in window)? 180 : 600,
     silentDegradeQualityIfNeeded : true

 });
 *
 */
;window.HTML5Panorama = (function(window, document) {

	// only for debug purpose. Manually set
	var debugInfo = false;

	// fps calculation engine
	var fps = {
		startTime : 0,
		frameNumber : 0,
		getFPS : function(){
			this.frameNumber++;
			var d = new Date().getTime(),
				currentTime = ( d - this.startTime ) / 1000,
				result = Math.floor( ( this.frameNumber / currentTime ) );

			if( currentTime > 1 ){
				this.startTime = new Date().getTime();
				this.frameNumber = 0;
			}
			return result;

		}
	};

	// adjust params on resize
	crossBrowserAddListener(window, 'resize',function() {
		calibrate();
		redraw();
	});

	// crossbrowser requestAnimationFrame
	var requestAnimFrame = (function(){
		return (
		window.requestAnimationFrame       ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame    ||
		window.oRequestAnimationFrame      ||
		window.msRequestAnimationFrame     ||
		function(/* function */ callback){
			window.setTimeout(callback, 1000 / 60);
		}
		);
	})();

	/**
	 * Number of image slices. Less - better performance, More - better quality.
	 * Default value when constructor option.num_slices is "auto"
	 */
	var num_slices = Math.min(600, window.innerWidth);



	// Horizontal field of view. About 120 degrees in humans.
	var fov = 120;

	// image scaling factor, used later.
	var scaleFactor = 1;

	// global references to the image, canvas and their attributes
	var img, ctx, cnvs, height, width;

	//angle corresponding to each pixel (column) of the original image, calculated on image load
	var degreePerPixel;

	var notYetMoved = true;

	/**
	 * constructor
	 * Here the only exported function
	 * @param options object options
	 */
	function __construct(options) {

		var defaults = {

			/**
			 * id of canvas element or DOMElement canvas
			 * @type {*} String or DOMElement
			 */

			canvas : 'canvas',

			/**
			 * source of image
			 * @type {String}
			 */
			src    : null,

			/**
			 * If you want move the panorama on load
			 */
			initialSpeed: 10,

			/**
			 * the number of slices. It can be
			 * - "auto" for default behavior (600 or window.width)
			 * - {Number} for explicit number of slices
			 */
			num_slices : 'auto',

			/**
			 * If true, run a FPS check that degrade the number of slices if the FPS is under a limit for a while
			 */
			silentDegradeQualityIfNeeded: true
		};

		for(var i in defaults) {
			if(!options.hasOwnProperty( i )) {
				options[i] = defaults[i];
			}
		}

		// normalize canvas
		if(typeof options.canvas === 'string') {
			cnvs = document.getElementById(options.canvas);
		}else {
			cnvs = options.canvas;
		}

		if(!cnvs) {
			console.error("HTML5Panorama Error: something goes wrong with 'canvas' option: " + options.canvas);
			return ;
		}
		if( options.num_slices !== 'auto' ) {
			num_slices = +options.num_slices;
		}

		delta = options.initialSpeed;

		// important for windows mobile
		preventUserSelect(cnvs);

		cnvs.width = window.innerWidth;
		cnvs.height = window.innerHeight;
		cnvs.style.cursor = 'ew-resize';

		addListener('hold', startdrag);
		addListener('leave', enddrag, document.body);
		addListener('keydown', keyDown, top.window);

		ctx = cnvs.getContext("2d"); // get drawing context for canvas (used later)

		img = new Image(); // fetch image
		img.onload = function() { // called once img has loaded
			height = img.height;
			width = img.width;
			//assume the image is a complete pano
			degreePerPixel = 360.0 / width;
			//center from the middle of the image
			currentpos = width/2;
			calibrate(); // calibrate scaling factor based on actual browser window size
			redraw();
			fpsCheck(cnvs, options.silentDegradeQualityIfNeeded);
		};
		img.onerror = function() {
			console.error("Image " + options.src + " is not loaded");
		};
		img.src = options.src;
	}

	var currentFps = fps.getFPS();
	var segmentLength, currentpos = 0, projectedlength, offsetHeight, angle, canvasCenter, projectedOffset = 0
		,startpoint,endpoint;

	function redraw() {
		var canvasused = 0.0;
		segmentLength = (1/degreePerPixel) *(fov/num_slices);//actual length of each image slice
		currentpos += delta / scaleFactor;

		//display the central part of the canvas on top: compensation factor
		offsetHeight = height * 2
		/ ((cosec(90 - fov / 2) - cosec(90)));

		if (currentpos > width) //code to reset the view after a full rotation has been completed
			currentpos -= width;
		if (currentpos < 0)
			currentpos += width;

		projectedOffset = 0;
		canvasCenter = cnvs.width / 2;

		for (var i=0; i<num_slices; i++)	//calculate projection for each slice
		{
			angle = 90-(fov/2-i*fov/num_slices);
			if(angle > 90)
				angle = 180-angle;
			projectedlength = (segmentLength*cosec(angle));	// projected length of a slice is proportional to the cosecant of it's position in the FOV

			startpoint = currentpos + i*segmentLength;	// some bookkeeping
			endpoint = startpoint + segmentLength;

			if (endpoint > width)
			{
				startpoint -= (width - segmentLength); // more reset code
			}

			// The magic step! canvas.drawimage(image, sx, sy, sw, sh, dx, dy, dw, dh)	- s:source, d:destination, h:height, w:width
			// Redraws original image by reprojecting it onto the canvas based on the trigonometric math above.
			ctx.drawImage(img, startpoint, 0, segmentLength, height, canvasused, height/2*(scaleFactor*(cosec(90-fov/2) - cosec(angle))), scaleFactor*projectedlength+1, height*scaleFactor*cosec(angle));
			// End of magic step
			canvasused += Math.round(scaleFactor*projectedlength); // more bookkeeping
		}

		if(debugInfo) {
			ctx.fillStyle = "#fff";
			ctx.fillRect(0,0, 200, 100);
			ctx.fillStyle = "#000";
			ctx.font = "normal 14pt sans-serif";
			ctx.fillText("fps: " +currentFps, 10, 20);
			ctx.fillText("num_slices: " +num_slices, 10, 40);
		}
		if(!holding) {
			if(!notYetMoved) {
				delta /= 1.05;
			}
			if( Math.abs(delta)|0> 0) {
				requestAnimFrame(redraw);
			}
		}
	}

	var mousepos;
	var delta = 0;
	var holding = false;

	// Mouse Event Handlers

	function startdrag(e) {
		e.preventDefault();
		e.stopPropagation();
		holding = true;
		notYetMoved = false;
		mousepos = getPosXFromEvent(e);

		addListener('move', drag, document.body);

	}

	function drag(e) {
		e.preventDefault();
		e.stopPropagation();

		var pageX = getPosXFromEvent(e);

		delta = mousepos - pageX;
		mousepos = pageX;

		requestAnimFrame(redraw);

	}

	function keyDown(e) {
		notYetMoved = false;
		var dir = 1;
		switch(e.keyCode) {
			case 37 :
				dir = -1;
			case 39 :
				holding = true;
				delta = dir*5;
				requestAnimFrame(redraw);
				break;
		}
	}

	function enddrag(e) {
		e.preventDefault();
		e.stopPropagation();

		removeListener('move', drag, document.body);
		holding = false;

		redraw();
	}

	//Utility Functions

	function cosec(theta) {
		return 1 / Math.sin(theta * Math.PI / 180);
	}

	function calibrate()
	{
		cnvs.width = window.innerWidth;
		cnvs.height = window.innerHeight;
		scaleFactor = Math.min(cnvs.width/(2+(width/280.0*fov)), cnvs.height/height/2); // scale to fit
	}


	function addListener(evnt, callback, elem) {

		if(!elem)  elem = cnvs;

		switch(evnt) {
			case 'hold' :
				crossBrowserAddListener(elem, 'touchstart'    , callback);
				crossBrowserAddListener(elem, 'MSPointerDown' , callback);
				crossBrowserAddListener(elem, 'mousedown'     , callback);
				break;
			case 'leave' :
				crossBrowserAddListener(elem, 'mouseup'       , callback);
				crossBrowserAddListener(elem, 'MSPointerUp'   , callback);
				crossBrowserAddListener(elem, 'touchend'      , callback);
				break;
			case 'move' :
				crossBrowserAddListener(elem, 'touchmove'     , callback);
				crossBrowserAddListener(elem, 'MSPointerMove' , callback);
				crossBrowserAddListener(elem, 'mousemove'     , callback);
				break;
			case 'keydown' :
				crossBrowserAddListener(elem, 'keydown'       , callback);
				break;
		}
	}
	function removeListener(evnt, callback, elem) {

		if(!elem)  elem = cnvs;

		switch(evnt) {
			case 'hold' :
				crossBrowserRemoveListener(elem, 'mousedown'     , callback);
				crossBrowserRemoveListener(elem, 'touchstart'    , callback);
				crossBrowserRemoveListener(elem, 'MSPointerDown' , callback);
				break;
			case 'leave' :
				crossBrowserRemoveListener(elem, 'mouseup'       , callback);
				crossBrowserRemoveListener(elem, 'touchend'      , callback);
				crossBrowserRemoveListener(elem, 'MSPointerUp'   , callback);
				break;
			case 'move' :
				crossBrowserRemoveListener(elem, 'mousemove'     , callback);
				crossBrowserRemoveListener(elem, 'touchmove'     , callback);
				crossBrowserRemoveListener(elem, 'MSPointerMove' , callback);
				break;
		}
	}

	function crossBrowserAddListener(elem, evnt, func) {
		if (elem.addEventListener)
			elem.addEventListener(evnt,func);
		else if (elem.attachEvent) { // IE DOM
			elem.attachEvent("on"+evnt, func);
		} else { // No much to do
			elem["on"+evnt] = func;
		}
	}
	function crossBrowserRemoveListener(elem, evnt, func) {
		if (elem.removeEventListener)  // W3C DOM
			elem.removeEventListener(evnt,func);
		else if (elem.attachEvent) { // IE DOM
			elem.detachEvent("on"+evnt, func);
		} else { // No much to do
			elem["on"+evnt] = null;
		}
	}

	function getPosXFromEvent(ev) {
		return (ev.hasOwnProperty("touches") && ev.touches[0].pageX) || (ev.pageX) || 0;
	}

	// IE mobile
	function preventUserSelect(el) {
		el.style['user-select']         = "none";
		el.style['-ms-user-select']     = "none";
		el.style['-moz-user-select']    = "none";
		el.style['-khtml-user-select']  = "none";
		el.style['-webkit-user-select'] = "none";

		el.style['touch-action']     = "none";
		el.style['-ms-touch-action'] = "none";
		el.style['-ms-touch-action'] = "none";

	}
	function fpsCheck(cnvs, autdegrade) {
		var countUnderTolerance = 0;
		var d1 = +new Date();
		var _fps = function() {
			currentFps = fps.getFPS();
			if(autdegrade && currentFps < 10 ) {
				countUnderTolerance++;
				if(countUnderTolerance > 10) {
					num_slices = Math.max(num_slices/4, (cnvs.width/100)|0);
					return ;
				}
				if(+new Date() - d1 > 5000) {
					countUnderTolerance = 0;
				}
				d1 = +new Date();
			}
			requestAnimFrame(_fps);
		};
		requestAnimFrame(_fps);
	}

	return __construct;

})(window, document);

