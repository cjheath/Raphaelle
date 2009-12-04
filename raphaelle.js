/*
 * Drag and drop for Raphael elements.
 *
 * You need to include jquery and jquery.dimension.js
 *
 * A click and motion on this Raphael element causes a drag to start.
 * Options:
 *   drag_obj
 *	Start the drag on this object instead of "this".
 *   right_button
 *	unset means drag using either button, otherwise its false or true for left or right.
 *   reluctance
 *	Number of pixels of motion before a drag starts (default 3).
 *
 * Optional methods on drag_obj. The event is passed so you can see the modifier keys.
 *  dragUpdate(dragging_over, x, y, event)
 *	replaces the default one (which uses Raphael's translate())
 *  dragStart(x, y, event)
 *	called (after reluctance) with the mousedown event and location.
 *  dragFinish(dropped_on, x, y, event)
 *	called with the mouseup event and location (if not cancelled).
 *  dragCancel()
 *	called if the drag is cancelled
 *
 * The escape key can be used to cancel a drag and revert the motion.
 */
Raphael.el.draggable = function(options) {
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

  if (typeof drag_obj.paper.fromPage == 'undefined') {
    // jquery.dimension and event.pagxX/Y excludes the body margin:
    var body_offset = $(document).contents().children('body').offset();
    drag_obj.paper.fromPage = 
      function(x,y) {
	if (x.pageX>=0) { // An Event was passed, not x,y
	  y = x.pageY; x = x.pageX;
	}
	var pp = $(drag_obj.paper.canvas.parentNode).position();
	// console.log('from page x='+x+', y='+y+' pos left='+pp.left+", top="+pp.top);
	return {x:x-body_offset.left-pp.left, y:y-body_offset.top-pp.top};
      };
  }

  // options.reluctance is the number of pixels of motion before a drag will start:
  var reluctance = options.reluctance;
  if (typeof reluctance == 'undefined') { reluctance = 3; }

  $(this.node).mousedown(
    function (event) {
      var dragging = true;
      var target = typeof event.target != 'undefined' ? event.target : event.srcElement;  // Firefox/IE
      if (target.nodeType == 3) { target = target.parentNode; }	// Safari
      // console.log("MouseDown on "+drag_obj.node.id+" with target="+target.id);

      // Set right_button to true for right-click dragging only, to false for left-click only. Otherwise you get both.
      var right_button = options.right_button;
      if (typeof right_button != 'undefined' && (right_button === false) === (event.button > 1)) { return; }

      var node = this;
      var started = false;
      var start_x, start_y;
      var last_x, last_y;
      var start_event = event;
      start_x = last_x = event.clientX;
      start_y = last_y = event.clientY;

      // Figure out what object (other than drag_obj) is under the pointer
      var over = function(event) {
	drag_obj.hide();
	var dragging_over = document.elementFromPoint(event.clientX, event.clientY);
	drag_obj.show();
	if (dragging_over.nodeType == 3) { dragging_over = dragging_over.parentNode; }	// Safari/Opera
	return dragging_over;
      };

      var mousemove = function(event) {
	// Hack to prevent Firefox from sometimes dragging the canvas element
	if (event.preventDefault) {
	  event.preventDefault();
	}

	// Figure out if the drag should start
	var delta_x = last_x-event.clientX;
	var delta_y = last_y-event.clientY;
	if (!started && (delta_x>reluctance || delta_x<-reluctance || delta_y>reluctance || delta_y<-reluctance)) {
	  started = true;

	  // REVISIT: Bring the object to the front so it doesn't drag behind things, and restore it later
	  if (typeof drag_obj.dragStart != 'undefined') {
	    var canvas_pos = drag_obj.paper.fromPage(event.pageX+delta_x, event.pageY+delta_y);
	    drag_obj.dragStart(canvas_pos.x, canvas_pos.y, start_event);
	  }
	}
	if (!started) { return; }

	var dragging_over = over(event);
	// console.log("Move "+drag_obj.node.id+" over "+dragging_over.id+" to X="+event.clientX+", Y="+event.clientY);
	drag_obj.dragUpdate(dragging_over, event.clientX-last_x, event.clientY-last_y, event);
	last_x = event.clientX;
	last_y = event.clientY;
      };

      var revert;
      var cancel;

      // Process keyboard input so we can cancel
      var key = function(event) {
	var code;
	if (!dragging) { return; }  // The unbind on keypress should do this for us anyhow.
	if (!event) { event = window.event; }
	if (event.keyCode) { code = event.keyCode; }
	else if (event.which) { code = event.which; }
	// var character = String.fromCharCode(code);
	// console.log("key="+code+" char="+character);
	if (code == 27) { // Escape
	  revert(event);
	  if (typeof drag_obj.dragCancel != 'undefined') {
	    drag_obj.dragCancel();
	  }
	  cancel();
	}
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
	    var canvas_pos = drag_obj.paper.fromPage(event);
	    drag_obj.dragFinish(dropped_on, canvas_pos.x, canvas_pos.y, event);
	  }
	  event.stopPropagation();
	  event.preventDefault();
	}
	cancel();
      };

      // Undo the setup for a drag
      cancel = function() {
	$(node.raphael.paper.canvas).unbind('mousemove', mousemove);
	$(node.raphael.paper.canvas).unbind('keypress', key);
	$(window).unbind('mouseup', mouseup);
	dragging = false;
      };

      // Bind the appropriate events:
      $(window).keypress(key);
      $(node.raphael.paper.canvas).mousemove(mousemove);
      $(window).mouseup(mouseup);
    }
  );
};
