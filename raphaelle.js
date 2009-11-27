Raphael.el.draggable = function() {
  var raph_obj = this;
  if (typeof this.node === 'undefined' && typeof this.paper === 'undefined')
  {
    log(this + 'is not a raphj obj so you can\'t make it draggabe');
    return;
  }
  
  $(this.node).mousedown(mousedown);
  
  function mousedown(event) {
    // log(raph_obj.node);
    // var node = event.target;

    var node = this;
    
    var mousemove = function(event) {
      //Hack to prevent firefox from sometimes dragging the canvas element
      if(event.preventDefault) {
        event.preventDefault();
      }

      //Set the xy coords 
      if (raph_obj.type == 'circle') {
        //circles use cx/cy for center of object instead of x/y, per the SVG spec
        raph_obj.attr('cx', event.clientX);
        raph_obj.attr('cy', event.clientY);
      }
      else
      {
        raph_obj.attr('x', event.clientX);
        raph_obj.attr('y', event.clientY);
      }
    }

    var mouseup = function(event) {
      $(node.raphael.paper.canvas).unbind('mousemove', mousemove);
      $(window).unbind('mouseup', mouseup);     
    }
    $(node.raphael.paper.canvas).mousemove(mousemove);
    $(window).mouseup(mouseup);   
  } 
}
