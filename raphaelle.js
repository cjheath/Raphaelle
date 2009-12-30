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
 *	Start the drag on this object instead of the handle (else define dragStart to return it).
 *   right_button
 *	unset means drag using either button, otherwise false/true means left/right only.
 *   reluctance
 *	Number of pixels of motion before a drag starts (default 3).
 *
 * Optional method on handle. The event is passed so you can see the modifier keys.
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

  var mousedown = function (event) {
    if (typeof right_button != 'undefined' && (right_button === false) === (event.button > 1))
      return true;

    var started = false;	// Has the drag started?
    var start_event = event;	// The starting mousedown
    var last_x = event.pageX, last_y = event.pageY;	// Where did we move from last?

    // Figure out what object (other than drag_obj) is under the pointer
    var over = function(event) {
      if (drag_obj) drag_obj.hide();
      // Unfortunately Opera's elementFromPoint seems to be hopelessly broken in SVG
      var dragging_over = document.elementFromPoint(event.pageX, event.pageY);
      if (drag_obj) drag_obj.show();
      if (!dragging_over)
	return null;
      if (dragging_over.nodeType == 3)
	return dragging_over.parentNode;  // Safari/Opera
      if (dragging_over.tagName != 'svg' && dragging_over == handle.paper.canvas.parentNode)
	return handle.paper.canvas;	  // Safari
      if (!dragging_over.raphael)
	return dragging_over.parentNode;  // A tspan inside a Raphael text object perhaps?
      return dragging_over;
    };

    var mousemove = function(event) {
      var delta_x = event.pageX-last_x;
      var delta_y = event.pageY-last_y;

      if (!started && (delta_x>reluctance || delta_x<-reluctance || delta_y>reluctance || delta_y<-reluctance)) {
	if (handle.dragStart) {
	  var position = $.browser.opera ? $(handle.paper.canvas.parentNode).offset() : $(handle.paper.canvas).offset();

	  drag_obj = handle.dragStart(event.pageX-delta_x-position.left, event.pageY-delta_y-position.top, start_event, event);
	  if (!drag_obj) return false; // Don't start the drag yet if told not to
	}
	started = true;
      }
      if (!started) return false;

      var dragging_over = over(event);
      // console.log("Move "+drag_obj.node.id+" over "+dragging_over.id+" to X="+event.pageX+", Y="+event.pageY);
      var update = drag_obj.dragUpdate ? drag_obj.dragUpdate : function(o, dx, dy, e) { drag_obj.translate(dx, dy); };
      update(dragging_over, delta_x, delta_y, event);
      last_x = event.pageX;
      last_y = event.pageY;
      return false;
    };

    var revert;
    var cancel;

    // Process keyboard input so we can cancel
    var key = function(event) {
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
      drag_obj.dragUpdate(null, start_event.pageX-last_x, start_event.pageY-last_y, event);
      started = false;  // Sometimes get the same event twice.
    };

    // The drag has ended, deal with it.
    var mouseup = function(event) {
      if (started) {
	var dropped_on = over(event);
	if (drag_obj.dragFinish) {
	  var position = $.browser.opera ? $(handle.paper.canvas.parentNode).offset() : $(handle.paper.canvas).offset();

	  drag_obj.dragFinish(dropped_on, event.pageX-position.left, event.pageY-position.top, event);
	}
	cancel();
	return false; // Don't let it bubble
      }
      cancel();
      return true;
    };

    // Undo event bindings after the drag
    cancel = function() {
      $(document).unbind('mouseup', mouseup);
      $(document).unbind('mousemove', mousemove);
      $(document).unbind('keydown', key);
      if ($.browser.msie) {
	// Rebind the mousedown, it gets lost somehow
	$(this.node).unbind('mousedown', mousedown);
	$(this.node).bind('mousedown', mousedown);
      }
      started = false;
    };

    // Bind the appropriate events for the duration of the drag:
    $(document).bind('keydown', key);
    $(document).bind('mousemove', mousemove);
    $(document).bind('mouseup', mouseup);
    return false;
  };
  $(handle.node).bind('mousedown', mousedown);
};
