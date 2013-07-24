$(function(){

  var w = 900,
      h = 500;

  var xPad = 10,
      yPad = 10,
      barPad = 1;

  var vis = d3.select("body").append("svg")
      .attr('width', w)
      .attr('height', h)
      .style('border', '1px solid black');

  var xScale = d3.scale.linear()
      .domain([])
      .range([xPad,w-xPad]);

  var render = function(dataset) {
    var bar = vis.selectAll('rect').data(dataset);

    bar.enter()
      .append('rect')
      .attr("x", xPad)
      .attr("y", function(d, i) {
        return i * (h / (dataset.length)) + yPad
      })
      .attr("width", function(d) {
        return d/15;
      })
      .attr("height", (h - 2*yPad)/dataset.length - barPad)
      .attr("fill", function(d) {
        return "rgb(0, 0, " + (d * 10) + ")";
      });
  };

});