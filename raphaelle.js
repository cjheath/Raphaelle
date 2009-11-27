// A click on this Raphael element causes "to_drag" to start dragging
Raphael.el.draggable = function(to_drag) {
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

  $(this.node).mousedown(mousedown);

  function mousedown(event) {
    // console.log("Over "+event.target);

    var node = this;
    var started = false;
    var last_x, last_y;
    last_x = event.clientX;
    last_y = event.clientY;

    var mousemove = function(event) {
      // Hack to prevent Firefox from sometimes dragging the canvas element
      if (event.preventDefault) {
        event.preventDefault();
      }

      var delta_x = last_x-event.clientX;
      var delta_y = last_y-event.clientY;
      if (!started && (delta_x>3 || delta_x<-3 || delta_y>3 || delta_y<-3)) {
	started = true;
      }
      if (!started) return;

      drag_obj.translate(event.clientX-last_x, event.clientY-last_y)
      last_x = event.clientX;
      last_y = event.clientY;
    }

    var mouseup = function(event) {
      $(node.raphael.paper.canvas).unbind('mousemove', mousemove);
      $(window).unbind('mouseup', mouseup);
    }
    $(node.raphael.paper.canvas).mousemove(mousemove);
    $(window).mouseup(mouseup);
  }
}
