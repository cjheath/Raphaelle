// A click on this Raphael element causes "to_drag" to start dragging.
// right_button = null means drag using either, otherwise its false or true for left or right.
// If the object being dragged has an updateDrag(x, y, ctrl, shift, alt), the default one isn't added
// If the object has startDrag(x, y) , and finishDrag(x, y), those are called.
Raphael.el.draggable = function(to_drag, right_button) {
  var drag_obj = to_drag != null ? to_drag : this;

  // Check that this is an ok thing to even think about:
  if (typeof this.node === 'undefined' && typeof this.paper === 'undefined') {
    console.log(this+' is not a Raphael object so you can\'t make it draggable');
    return;
  }
  if (typeof drag_obj.node === 'undefined' && typeof drag_obj.paper === 'undefined') {
    console.log(drag_obj+' is not a Raphael object so you can\'t make it draggable');
    return;
  }

  $(this.node).mousedown(
    function (event) {
      // var target = event.target == null ? event.target : event.srcElement;  // Firefox/IE
      // if (target.nodeType == 3) target = target.parentNode;	// Safari
      // console.log("Over "+target);

      if (right_button != null && (right_button == true) != (event.button > 1)) return;

      var node = this;
      var started = false;
      var start_x, start_y;
      var last_x, last_y;
      start_x = last_x = event.clientX;
      start_y = last_y = event.clientY;

      // REVISIT: Bring the object to the front so it doesn't drag behind things, and restore it later

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

	  if (drag_obj.updateDrag == null) {
	    drag_obj.updateDrag = function(xdelta, ydelta) {
	      drag_obj.translate(xdelta, ydelta);
	    }
	  }
	  if (drag_obj.startDrag != null) {
	    drag_obj.startDrag(last_x, last_y)
	  }
	}
	// console.log("X="+event.clientX+", Y="+event.clientY);
	if (!started) return;

	drag_obj.updateDrag(event.clientX-last_x, event.clientY-last_y, event.ctrlKey, event.shiftKey, event.altKey);
	last_x = event.clientX;
	last_y = event.clientY;
      }

      // Process keyboard input so we can cancel
      var key = function(event) {
	var code;
	if (!event) event = window.event;
	if (event.keyCode) code = event.keyCode;
	else if (event.which) code = event.which;
	var character = String.fromCharCode(code);
	// console.log("key="+code+" char="+character);
	if (code == 27) { // Escape
	  revert(event);
	  cancel();
	}
      }

      // Revert to starting location
      var revert = function(event) {
	if (!started) return;
	// console.log("start_x="+start_x+", start_y="+start_y+"; last_x="+last_x+", last_y="+last_y);
	drag_obj.updateDrag(start_x-last_x, start_y-last_y, event.ctrlKey, event.shiftKey, event.altKey);
	started = false;  // Sometimes get the same event twice.
      }

      // Undo the setup for a drag
      var cancel = function() {
	$(node.raphael.paper.canvas).unbind('mousemove', mousemove);
	$(node.raphael.paper.canvas).unbind('key', key);
	$(window).unbind('mouseup', mouseup);
      }

      // The drag has ended, deal with it.
      var mouseup = function(event) {
	if (started) {
	  // console.log("You dropped "+drag_obj+" and almost broke it");
	  if (drag_obj.finishDrag != null) {
	    drag_obj.finishDrag(last_x, last_y)
	  }
	}
	cancel();
      }

      // Bind the appropriate events:
      $(window).keypress(key);
      $(node.raphael.paper.canvas).mousemove(mousemove);
      $(window).mouseup(mouseup);
    }
  );
}
