// A click on this Raphael element causes "to_drag" to start dragging.
// right_button = null means drag using either, otherwise its false or true for left or right.
// If the object being dragged has an updateDrag(dragging_over, x, y, event), the default one isn't added
// If the object has startDrag(x, y, event) , and finishDrag(dropped_on, x, y), those are called.
Raphael.el.draggable = function(to_drag, right_button) {
  var drag_obj;
  // drag_obj = to_drag != null ? to_drag : this;
  if (to_drag != null) { drag_obj = to_drag; } else { drag_obj = this; }

  // Check that this is an ok thing to even think about:
  if (typeof this.node == 'undefined' && typeof this.paper == 'undefined') {
    console.log(this+' is not a Raphael object so you can\'t make it draggable');
    return;
  }
  if (typeof drag_obj.node == 'undefined' && typeof drag_obj.paper == 'undefined') {
    console.log(drag_obj+' is not a Raphael object so you can\'t make it draggable');
    return;
  }

  $(this.node).mousedown(
    function (event) {
      var dragging = true;
      var target = typeof event.target != 'undefined' ? event.target : event.srcElement;  // Firefox/IE
      if (target.nodeType == 3) target = target.parentNode;	// Safari
      // console.log("MouseDown on "+drag_obj.node.id+" with target="+target.id);

      if (typeof right_button != 'undefined' && (right_button == false) === (event.button > 1)) { return; }

      var node = this;
      var started = false;
      var start_x, start_y;
      var last_x, last_y;
      var start_event = event;
      start_x = last_x = event.clientX;
      start_y = last_y = event.clientY;

      var over = function(event) {
	drag_obj.hide();
	var dragging_over = document.elementFromPoint(event.clientX, event.clientY);
	drag_obj.show();
	if (dragging_over.nodeType == 3) dragging_over = dragging_over.parentNode;	// Safari/Opera
	return dragging_over;
      }

      var mousemove = function(event) {
	// Hack to prevent Firefox from sometimes dragging the canvas element
	if (event.preventDefault) {
	  event.preventDefault();
	}

	// Figure out if the drag should start
	var delta_x = last_x-event.clientX;
	var delta_y = last_y-event.clientY;
	if (!started && (delta_x>3 || delta_x<-3 || delta_y>3 || delta_y<-3)) {
	  started = true;

	  // REVISIT: Bring the object to the front so it doesn't drag behind things, and restore it later
	  if (typeof drag_obj.startDrag != 'undefined') {
	    drag_obj.startDrag(last_x, last_y, start_event);
	  }
	}
	if (!started) { return; }

	var dragging_over = over(event);
	// console.log("Move "+drag_obj.node.id+" over "+dragging_over.id+" to X="+event.clientX+", Y="+event.clientY);
	drag_obj.updateDrag(dragging_over, event.clientX-last_x, event.clientY-last_y, event);
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
	var character = String.fromCharCode(code);
	// console.log("key="+code+" char="+character);
	if (code == 27) { // Escape
	  revert(event);
	  cancel();
	}
      };

      // Revert to starting location
      revert = function(event) {
	if (!started) { return; }
	// console.log("start_x="+start_x+", start_y="+start_y+"; last_x="+last_x+", last_y="+last_y);
	drag_obj.updateDrag(null, start_x-last_x, start_y-last_y, event);
	started = false;  // Sometimes get the same event twice.
      };

      // The drag has ended, deal with it.
      var mouseup = function(event) {
	if (started) {
	  var dropped_on = over(event);
	  if (typeof drag_obj.finishDrag != 'undefined') {
	    drag_obj.finishDrag(dropped_on, last_x, last_y);
	  }
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
