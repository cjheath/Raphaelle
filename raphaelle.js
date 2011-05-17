/*
 * Drag and drop for Raphael elements.
 *
 * Requires jQuery, to bind mouse events on document.
 *
 * Original Author: Gabe Hollombe. Rewritten several times over by Clifford Heath.
 * (c) Copyright. Subject to MIT License.
 *
 * You need to include jquery and Raphael first.
 *
 * When you call draggable() on any Raphael object, it becomes a handle that can start a drag.
 * A mousedown on the handle followed by enough motion causes a drag to start.
 *
 * The dragged object may be the handle itself, another object defined in the options to
 * draggable(), or an object returned from the handle's dragStart method (if defined).
 *
 * In addition, if you wish to immediately start a drag on a draggable object, just
 * call object.draggable.drag(), and pass the event (if available) that has a valid
 * clientX, clientY value for the current mouse position. If you don't have it, the
 * drag will appear to have started from 0,0 in the current parent, and will jump to
 * the mouse position on the first move. Awkward, but sometimes useful...
 *
 * The drag proceeds by calling drag_obj.dragUpdate for each mouse motion, see below.
 * If no dragUpdate is defined, a Raphael translate() is used to provide simple motion.
 *
 * If the Escape key is pressed during the drag, the motion is reverted and the drag stops.
 * In this case, dragCancel will be called, see below.
 *
 * When a drag finished normally, dragFinish is called as defined below.
 *
 * Options:
 *   drag_obj
 *	A click on the handle will start a drag on this object.
 *	Otherwise handle will be dragged, unless handle.dragStart()
 *	returns a different draggable object.
 *   right_button
 *	unset means drag using either button, otherwise false/true means left/right only.
 *   reluctance
 *	Number of pixels of motion before a drag starts (default 3).
 *
 * Optional method on handle. The events are passed so you can see the modifier keys.
 *  dragStart(x, y, mousedownevent, mousemoveevent)
 *	called (after reluctance) with the mousedown event and canvas location.
 *	Must return either:
 *	- the object to drag. A good place to call toFront so the drag_obj doesn't hide.
 *	- null or false. The drag won't start yet, and dragStart will be called again.
 *	- true. The drag won't start, but the mouseDown event should bubble.
 *
 * Optional methods on drag_obj. The event is passed so you can see the modifier keys.
 *  dragUpdate(dragging_over, dx, dy, event)
 *	dragging_over:	the object under the cursor (after hiding drag_obj)
 *	dx,dy:		the number of units of motion
 *	event:		the mousemotion event
 *  dragFinish(dropped_on, x, y, event)
 *	dropped_on:	the object under the cursor (after hiding drag_obj)
 *	x,y:		the page location
 *	event:		the mouseup event
 *  dragCancel()
 *	called if the drag is cancelled
 */

Raphael.el.draggable = function(options) {
  var handle = this;  // The object you click on
  if (!options) options = {};
  // If you define drag_obj to be null, you must provide a dragStart that returns one:
  var drag_obj = typeof options.drag_obj !== 'undefined' ? options.drag_obj : handle;
  var paper = handle.paper;

  // Set right_button to true for right-click dragging only, to false for left-click only. Otherwise you get both.
  var right_button = options.right_button;

  // Check that this is an ok thing to even think about doing
  if (!(handle.node && handle.node.raphael)) {
    alert(handle+' is not a Raphael object so you can\'t make it draggable');
    return;
  }
  if (drag_obj && !(drag_obj.node && drag_obj.node.raphael)) {
    alert(drag_obj+' is not a Raphael object so you can\'t make it draggable');
    return;
  }

  // options.reluctance is the number of pixels of motion before a drag will start:
  var reluctance = options.reluctance;
  if (typeof reluctance == 'undefined') reluctance = 3;

  var skip_click;

  var dragNow = function(drag_obj, startEvent, startImmediately) {
    skip_click = false;		// Used to skip a click after dragging
    var started = false;	// Has the drag started?
    var last_x = startEvent && startEvent.clientX,	// Where did we move from last?
	last_y = startEvent && startEvent.clientY;
    var startClientX = last_x, startClientY = last_y;

    if (startImmediately) {
      started = true;
      skip_click = true;
    }

    // Figure out what object (other than drag_obj) is under the pointer
    var over = function(event) {
      if (drag_obj) drag_obj.hide();
      var dragging_over = document.elementFromPoint(event.clientX, event.clientY);
      if ($.browser.opera && dragging_over.tagName === 'svg') {
	// Opera's elementFromPoint always returns the SVG object.
	var svg = paper.canvas;
	var so = $(svg).offset();
	// var so = canvas_offset(svg);
	var sr = svg.createSVGRect();
	sr.x = event.clientX-so.left;
	sr.y = event.clientY-so.top;
	sr.width = sr.height = 1;
	var hits = svg.getIntersectionList(sr, null);
	if (hits.length > 0)
	{
	 dragging_over = hits[hits.length-1];
	 // drag_obj.hide() probably hasn't taken effect yet. Hope it's not a compound object:
	 if (dragging_over == drag_obj.node && hits.length > 1)
	   dragging_over = hits[hits.length-2];
	}
      }
      if (drag_obj) drag_obj.show();
      if (!dragging_over)
	return null;
      if (dragging_over.nodeType == 3)
	return dragging_over.parentNode;  // Safari/Opera
      if (dragging_over.tagName != 'svg' && dragging_over == paper.canvas.parentNode)
	return paper.canvas;	  // Safari
      if (dragging_over == paper.canvas)
	return dragging_over;
      if (!dragging_over.raphael)
	return dragging_over.parentNode;  // A tspan inside a Raphael text object perhaps?
      return dragging_over;
    };

    var canvas_offset = function(canvas) {
      if (!$.browser.opera && canvas.getClientRects)
      {
	// This works around a bug in Chrome 8.0.552.215
	var cr = canvas.getClientRects()[0];
	return {top: cr.top, left: cr.left };
      }
      return jQuery(canvas).offset();
    };

    var mousemove = function(event) {
      if (event.dragSeen)
	return false;	// Avoid multiple delivery; this indicates a bug in user code.
      event.dragSeen = true;
      var position;
      var delta_x, delta_y;
      if (last_x === undefined || last_x === null) {  // From startImmediately
	position = canvas_offset(paper.canvas);
	delta_x = last_x = event.clientX-position.left;
	delta_y = last_y = event.clientY-position.top;
	drag_obj.show();
      }
      else
      {
	delta_x = event.clientX-last_x;
	delta_y = event.clientY-last_y;
      }

      if (!started && (delta_x>=reluctance || delta_x<=-reluctance || delta_y>=reluctance || delta_y<=-reluctance)) {
	if (handle.dragStart) {
	  position = canvas_offset(paper.canvas);

	  var o = handle.dragStart(event.clientX-delta_x-position.left, event.clientY-delta_y-position.top, startEvent, event);
	  if (!o || o === true)
	    return !!o; // Don't start the drag yet if told not to
	  drag_obj = o;
	}
	started = true;
	skip_click = true;
      }
      if (!started || !drag_obj) return false;

      var dragging_over = over(event);
      // console.log("Move "+drag_obj.id+" over "+dragging_over.id+" to X="+event.clientX+", Y="+event.clientY);
      var update = drag_obj.dragUpdate ? drag_obj.dragUpdate : function(o, dx, dy, e) { drag_obj.translate(dx, dy); };
      update(dragging_over, delta_x, delta_y, event);
      paper.safari();
      last_x = event.clientX;
      last_y = event.clientY;
      return false;
    };

    if (!started && reluctance === 0 && handle.dragStart) {
      var position = canvas_offset(paper.canvas);
      var o = handle.dragStart(startClientX-position.left, startClientY-position.top, startEvent, startEvent);
      if (!o || o === true)
	return !!o; // Don't start the drag yet if told not to
      drag_obj = o;
      started = true;
      skip_click = true;
    }

    var revert;
    var cancel;

    // Process keyboard input so we can cancel
    var keydown = function(event) {
      if (event.keyCode == 27) { // Escape
	revert(event);
	if (drag_obj.dragCancel)
	  drag_obj.dragCancel();
	cancel();
	return false;
      }
      return true;
    };

    // Revert to starting location
    revert = function(event) {
      if (!started) return;
      if (drag_obj && drag_obj.dragUpdate)
	drag_obj.dragUpdate(null, startClientX-last_x, startClientY-last_y, event);
      started = false;  // Sometimes get the same event twice.
    };

    // The drag has ended, deal with it.
    var mouseup = function(event) {
      if (started) {
	var dropped_on = over(event);
	if (drag_obj && drag_obj.dragFinish) {
	  var position = canvas_offset(paper.canvas);

	  drag_obj.dragFinish(dropped_on, event.clientX-position.left, event.clientY-position.top, event);
	}
	cancel();
	skip_click = true;
	return true; // Don't let it bubble
      }
      cancel();
      return true;
    };

    // Undo event bindings after the drag
    cancel = function() {
      $(document).unbind('mouseup', mouseup);
      $(document).unbind('mousemove', mousemove);
      $(document).unbind('keydown', keydown);
      paper.safari();

      started = false;
    };

    // Bind the appropriate events for the duration of the drag:
    $(document).bind('keydown', keydown);
    $(document).bind('mousemove', mousemove);
    $(document).bind('mouseup', mouseup);
    return false;
  };

  var mousedown = function(event) {
    event = jQuery.event.fix(event);
    if (typeof right_button != 'undefined' && (right_button === false) === (event.button > 1))
      return true;
    var bubble = dragNow(drag_obj, event);
    if (!bubble)
      event.stopImmediatePropagation(); // Ensure that whatever drag we start, there's only one!
    return bubble;
  };

  var click = function(event) {
    event = jQuery.event.fix(event);
    if (skip_click)
      event.stopImmediatePropagation();
    skip_click = false;		// Used to skip a click after dragging
    return true;
  };
  handle.mousedown(mousedown);
  handle.click(click);	  // Bind click now so that we can stop other click handlers

  /*
   * Start a drag immediately, using the drag_obj passed,
   * and with the initial mouse location as given by event.
   * If the event is not available, the first delta will
   * appear to be from 0,0.
   */
  this.draggable.drag = function(drag_obj, event) {
    return dragNow(drag_obj || handle, event, true);
  };
};
