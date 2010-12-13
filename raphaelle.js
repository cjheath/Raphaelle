/*
 * Drag and drop for Raphael elements.
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
 *	Must return the object to drag. Good place to call toFront so the drag_obj doesn't hide.
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
  var mousedown = function(event) {
    if (typeof right_button != 'undefined' && (right_button === false) === (event.button > 1))
      return true;

    skip_click = false;		// Used to skip a click after dragging
    var started = false;	// Has the drag started?
    var start_event = event;	// The starting mousedown
    var last_x = event.clientX, last_y = event.clientY;	// Where did we move from last?

    // Figure out what object (other than drag_obj) is under the pointer
    var over = function(event) {
      var paper = handle.paper || drag_obj.paper;
      if (!paper) return null;	// Something was deleted
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
    }

    var mousemove = function(event) {
      // REVISIT: Need to use some_svg_element_node.getScreenCTM() with SVG zooming comes into play
      var delta_x = event.clientX-last_x;
      var delta_y = event.clientY-last_y;

      if (!started && (delta_x>=reluctance || delta_x<=-reluctance || delta_y>=reluctance || delta_y<=-reluctance)) {
	if (handle.dragStart) {
	  var position = canvas_offset(handle.paper.canvas);

	  var o = handle.dragStart(event.clientX-delta_x-position.left, event.clientY-delta_y-position.top, start_event, event);
	  if (!o) return false; // Don't start the drag yet if told not to
	  drag_obj = o;
	}
	started = true;
	skip_click = true;
      }
      if (!started || !drag_obj) return false;

      var dragging_over = over(event);
      // console.log("Move "+drag_obj.node.id+" over "+dragging_over.id+" to X="+event.clientX+", Y="+event.clientY);
      var update = drag_obj.dragUpdate ? drag_obj.dragUpdate : function(o, dx, dy, e) { drag_obj.translate(dx, dy); };
      update(dragging_over, delta_x, delta_y, event);
      handle.paper.safari();
      last_x = event.clientX;
      last_y = event.clientY;
      return false;
    };

    if (reluctance == 0 && handle.dragStart) {
      var o = handle.dragStart(0, 0, event, event);
      if (!o) return false;
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
	drag_obj.dragUpdate(null, start_event.clientX-last_x, start_event.clientY-last_y, event);
      started = false;  // Sometimes get the same event twice.
    };

    // The drag has ended, deal with it.
    var mouseup = function(event) {
      if (started) {
	var dropped_on = over(event);
	if (drag_obj && drag_obj.dragFinish) {
	  var position = canvas_offset(handle.paper.canvas);

	  drag_obj.dragFinish(dropped_on, event.clientX-position.left, event.clientY-position.top, event);
	}
	cancel();
	return true; // Don't let it bubble
      }
      cancel();
      return true;
    };

    // Undo event bindings after the drag
    handle.originalDraggableNode = handle.node;
    cancel = function() {
      $(document).unbind('mouseup', mouseup);
      $(document).unbind('mousemove', mousemove);
      $(document).unbind('keydown', keydown);
      if ($.browser.msie) {
	// Rebind the mousedown if it got lost when the node was recreated:
	if (handle.originalDraggableNode != handle.node)
	  $(handle.node).bind('mousedown', mousedown);
	handle.originalDraggableNode = handle.node;
      }
      handle.paper.safari();

      started = false;
    };

    // Bind the appropriate events for the duration of the drag:
    $(document).bind('keydown', keydown);
    $(document).bind('mousemove', mousemove);
    $(document).bind('mouseup', mouseup);

    event.stopImmediatePropagation(); // Ensure that whatever drag we start, there's only one!
    return false;
  };
  var click = function(event) {
    if (skip_click)
      event.stopImmediatePropagation();
    skip_click = false;		// Used to skip a click after dragging
    return true;
  };
  $(handle.node).bind('mousedown', mousedown);
  $(handle.node).bind('click', click);	  // Bind click now so that we can stop other click handlers
};
