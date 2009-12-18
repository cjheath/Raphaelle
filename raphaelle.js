/*
 * Drag and drop for Raphael elements.
 * Original Author: Gabe Hollombe. Rewritten several times over by Clifford Heath.
 * (c) Copyright. Subject to MIT License.
 *
 * You need to include jquery and Raphael first.
 *
 * A click and enough motion on this Raphael element causes a drag to start.
 * Options:
 *   drag_obj
 *	Start the drag on this object instead of "this".
 *   right_button
 *	unset means drag using either button, otherwise its false or true for left or right.
 *   reluctance
 *	Number of pixels of motion before a drag starts (default 3).
 *
 * Optional methods on drag_obj. The event is passed so you can see the modifier keys.
 *  dragUpdate(dragging_over, dx, dy, event)
 *	override the default, which calls Raphael's translate(dx, dy)
 *  dragStart(x, y, event)
 *	called (after reluctance) with the mousedown event and canvas location.
 *  dragFinish(dropped_on, x, y, event)
 *	called with the mouseup event and canvas location
 *  dragCancel()
 *	called if the drag is cancelled
 *
 * The escape key can be used to cancel a drag and revert the motion.
 */
Raphael.el.draggable = function(options) {
  var handle = this;  // The object you click on
  if (typeof options == 'undefined') { options = {}; }
  var drag_obj = options.drag_obj;
  if (typeof drag_obj == 'undefined') { drag_obj = this; }

  // Check that this is an ok thing to even think about doing
  if (typeof this.node == 'undefined' && typeof this.paper == 'undefined') {
    console.log(this+' is not a Raphael object so you can\'t make it draggable');
    return;
  }
  if (typeof drag_obj.node == 'undefined' && typeof drag_obj.paper == 'undefined') {
    console.log(drag_obj+' is not a Raphael object so you can\'t make it draggable');
    return;
  }

  // options.reluctance is the number of pixels of motion before a drag will start:
  var reluctance = options.reluctance;
  if (typeof reluctance == 'undefined') { reluctance = 3; }

  var mousedown = function (event) {
    var dragging = true;
    var target = typeof event.target != 'undefined' ? event.target : event.srcElement;  // Firefox/IE
    if (target.nodeType == 3) { target = target.parentNode; }	// Safari
    // console.log("MouseDown on "+drag_obj.node.id+" with target="+target.id);

    // Set right_button to true for right-click dragging only, to false for left-click only. Otherwise you get both.
    var right_button = options.right_button;
    if (typeof right_button != 'undefined' && (right_button === false) === (event.button > 1))
      return true;

    var node = this;
    var started = false;
    var start_x, start_y;
    var last_x, last_y;
    var start_event = event;
    start_x = last_x = event.pageX;
    start_y = last_y = event.pageY;

    // Figure out what object (other than drag_obj) is under the pointer
    var over = function(event) {
      drag_obj.hide();
      var dragging_over = document.elementFromPoint(event.pageX, event.pageY);
      drag_obj.show();
      if (dragging_over && dragging_over.nodeType == 3) { dragging_over = dragging_over.parentNode; }	// Safari/Opera
      return dragging_over;
    };

    var mousemove = function(event) {
      var delta_x = event.pageX-last_x;
      var delta_y = event.pageY-last_y;

      // Figure out if the drag should start
      if (!started && (delta_x>reluctance || delta_x<-reluctance || delta_y>reluctance || delta_y<-reluctance)) {
	started = true;

	// dragStart is a good place to bring the object to the front so it doesn't drag behind things:
	if (typeof drag_obj.dragStart != 'undefined') {
	  var position = $.browser.opera ? $(drag_obj.paper.canvas.parentNode).offset() : $(drag_obj.paper.canvas).offset();

	  drag_obj.dragStart(event.pageX-delta_x-position.left, event.pageY-delta_y-position.top, start_event);
	}
	if (typeof drag_obj.dragUpdate == 'undefined') {
	  drag_obj.dragUpdate = function(o, dx, dy, e) {
	    drag_obj.translate(dx, dy);
	  };
	}
      }
      if (!started) { return false; }

      var dragging_over = over(event);
      // console.log("Move "+drag_obj.node.id+" over "+dragging_over.id+" to X="+event.pageX+", Y="+event.pageY);
      drag_obj.dragUpdate(dragging_over, delta_x, delta_y, event);
      last_x = event.pageX;
      last_y = event.pageY;
      return false;
    };

    var revert;
    var cancel;

    // Process keyboard input so we can cancel
    var key = function(event) {
      var code;
      if (!dragging) { return true; } // Take care

      //alert("key "+event.keyCode);
      if (event.keyCode == 27) { // Escape
	revert(event);
	if (typeof drag_obj.dragCancel != 'undefined') {
	  drag_obj.dragCancel();
	}
	cancel();
	return false;
      }
      return true;
    };

    // Revert to starting location
    revert = function(event) {
      if (!started) { return; }
      // console.log("start_x="+start_x+", start_y="+start_y+"; last_x="+last_x+", last_y="+last_y);
      drag_obj.dragUpdate(null, start_x-last_x, start_y-last_y, event);
      started = false;  // Sometimes get the same event twice.
    };

    // The drag has ended, deal with it.
    var mouseup = function(event) {
      if (started) {
	var dropped_on = over(event);
	if (typeof drag_obj.dragFinish != 'undefined') {
	  var position = $.browser.opera ? $(drag_obj.paper.canvas.parentNode).offset() : $(drag_obj.paper.canvas).offset();

	  drag_obj.dragFinish(dropped_on, event.pageX-position.left, event.pageY-position.top, event);
	}
      }
      cancel();
      return started ? false : true;  // Let the mouseup bubble if we didn't start dragging
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
      dragging = false;
    };

    // Bind the appropriate events for the duration of the drag:
    $(document).bind('keydown', key);
    $(document).bind('mousemove', mousemove);
    $(document).bind('mouseup', mouseup);
    return false;
  };
  $(this.node).bind('mousedown', mousedown);
};
