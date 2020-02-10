"use strict";

var PNUM = 512;
var mPos = [];
var maxPosLength = 12;
var mReleased = false;

function main() {
  // Get A WebGL context
  var canvas = document.getElementById("c");
  var gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  // get mouse position
  var mouseX = 0;
  var mouseY = 0;

  //set up shader program
  var vertexShader = createShader(gl, gl.VERTEX_SHADER,vertexShaderText);
  var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER,fragmentShaderText);
  var program = createProgram(gl,vertexShader,fragmentShader);

  //shader file to draw a quad in vertexshader
  var quad_vertexShader = createShader(gl, gl.VERTEX_SHADER,quad_vertexShaderText);

  //set up shader program used to update position storing textures
  var pos_fragmentShader = createShader(gl, gl.FRAGMENT_SHADER,pos_fragmentShaderText);
  var pos_program = createProgram(gl,quad_vertexShader,pos_fragmentShader);

  //set up shader program used to update velocity storing textures 
  var vel_fragmentShader = createShader(gl, gl.FRAGMENT_SHADER,vel_fragmentShaderText);
  var vel_program = createProgram(gl,quad_vertexShader,vel_fragmentShader);

  //shader program to draw trail textures
  var trail_fragmentShader = createShader(gl, gl.FRAGMENT_SHADER,trail_fragmentShaderText);
  var trail_program = createProgram(gl,quad_vertexShader,trail_fragmentShader);

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(program, "a_position");
  var pos_positionLocation = gl.getAttribLocation(pos_program, "a_position");
  var vel_positionLocation = gl.getAttribLocation(vel_program, "a_position");
  var trail_positionLocation = gl.getAttribLocation(trail_program, "a_position");

  // lookup uniforms
  var iTimeUniform = gl.getUniformLocation(program, "iTime");
  var pos_iTimeUniform = gl.getUniformLocation(pos_program, "iTime");
  var pos_iResolution = gl.getUniformLocation(pos_program, "iResolution");
  var vel_iTimeUniform = gl.getUniformLocation(vel_program, "iTime");
  var vel_iResolution = gl.getUniformLocation(vel_program, "iResolution");
  var vel_iMouse = gl.getUniformLocation(vel_program, "iMouse");
  var vel_mPos = gl.getUniformLocation(vel_program, "mPos");
  var trail_opacity = gl.getUniformLocation(trail_program, "opacity");

  var program_postexUniform = gl.getUniformLocation(program, "pos_texture");
  var program_veltexUniform = gl.getUniformLocation(program, "vel_texture");
  var pos_program_postexUniform = gl.getUniformLocation(pos_program, "pos_texture");
  var pos_program_veltexUniform = gl.getUniformLocation(pos_program, "vel_texture");
  var vel_program_postexUniform = gl.getUniformLocation(vel_program, "pos_texture");
  var vel_program_veltexUniform = gl.getUniformLocation(vel_program, "vel_texture");
  var trail_program_texUniform = gl.getUniformLocation(trail_program, "trail_texture");

  // Create a buffer for positions
  var positionBuffer = gl.createBuffer();
  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // Put the positions in the buffer
  var grid = [];
  for(let i=0; i<PNUM; i++){
    for(let j=0; j<PNUM; j++){
      grid.push(i/PNUM);
      grid.push(j/PNUM);
    }
  }
  console.log(grid.length);
  setGeometry(gl,grid);

  var quadpos = new Float32Array(
    [
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1
    ]);
  //Create a position buffer for a quad
  var quad_positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,quad_positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadpos, gl.STATIC_DRAW);


  //make a texture for initial position coordinates
  var posTexture = gl.createTexture();
  var scale = Math.floor(Math.pow(255, 2) / Math.max(gl.canvas.width,gl.canvas.height));
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, posTexture);
  {
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = PNUM;
    const height = PNUM;
    const border = 0;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    // Set initial Texcoords.
    var pos = [];
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    for(let i=0; i<PNUM*PNUM*4; i+=4){
      let x = Math.random()*gl.canvas.width; //x -->r,g
      let y = Math.random()*gl.canvas.height; //y -->b,a
      //encode picked values
      let posx = encode(x,scale);
      let posy = encode(y,scale);
      //x
      pos[i] = posx[0]; //r
      pos[i+1] = posx[1]; //g
      //y
      pos[i+2] = posy[0]; //b
      pos[i+3] = posy[1]; //a
    }
    console.log(pos.length);
    const data = new Uint8Array(pos);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border,
                  format, type, data);

    // set the filtering so we don't need mips and it's not filtered
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  {
  // Create and bind the framebuffer
  var posfb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, posfb);

  // attach the texture as the first color attachment
  const attachmentPoint = gl.COLOR_ATTACHMENT0;
  const level = 0;
  gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, posTexture, level);
  }

  //set up textures
  function createAndSetupTexture(gl,unit){
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
   
    // Set up texture so we can render any size image and so we are
    // working with pixels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
   
    return texture;
  }

  //-------->part to setup two additional textures and framebuffer to pingpong for positions
  { 
    // create 2 textures and attach them to framebuffers.
    var pos_textures = [];
    var pos_framebuffers = [];
    for (var ii = 0; ii < 2; ii++) {
      var pos_texture = createAndSetupTexture(gl,0);
      pos_textures.push(pos_texture);
   
      // make the texture the same size as posTexture
      gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, PNUM, PNUM, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, null);
   
      // Create a framebuffer
      var pos_fbo = gl.createFramebuffer();
      pos_framebuffers.push(pos_fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, pos_fbo);
   
      // Attach a texture to it.
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pos_texture, 0
      );
    }
  }

  //-------->part to setup two additional textures and framebuffer to pingpong for velocity
  {
    // create 2 textures and attach them to framebuffers.
    var vel_textures = [];
    var vel_framebuffers = [];
    for (var ii = 0; ii < 2; ii++) {
      var vel_texture = createAndSetupTexture(gl,2);
      vel_textures.push(vel_texture);
   
      // make the texture the same size as posTexture
      gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, PNUM, PNUM, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, null);
   
      // Create a framebuffer
      var vel_fbo = gl.createFramebuffer();
      vel_framebuffers.push(vel_fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, vel_fbo);
   
      // Attach a texture to it.
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, vel_texture, 0
      );
    }
  }

  //-------->part to setup two additional textures and framebuffer to pingpong to draw trails
  {
    // create 2 textures and attach them to framebuffers.
    var trail_textures = [];
    var trail_framebuffers = [];
    for (var ii = 0; ii < 2; ii++) {
      var trail_texture = createAndSetupTexture(gl,1);
      trail_textures.push(trail_texture);
      webglUtils.resizeCanvasToDisplaySize(gl.canvas);
      // make the texture the same size as canvas
      gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, null);
   
      // Create a framebuffer
      var trail_fbo = gl.createFramebuffer();
      trail_framebuffers.push(trail_fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, trail_fbo);
   
      // Attach a texture to it.
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trail_texture, 0
      );
    }
    
  }

  function setFramebuffer(fbo) {
    // make this the framebuffer we are rendering to.
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
   
    // Tell webgl the viewport setting needed for framebuffer.
    gl.viewport(0, 0, PNUM, PNUM);
  }

  function drawToPosTexture(time){
    gl.useProgram(pos_program);
    gl.enableVertexAttribArray(pos_positionLocation);
    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, quad_positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
      pos_positionLocation, size, type, normalize, stride, offset
    );

    gl.uniform1i(pos_program_postexUniform,0);
    gl.uniform1i(pos_program_veltexUniform,2);
    gl.uniform1f(pos_iTimeUniform,time);
    gl.uniform2fv(pos_iResolution,[gl.canvas.width,gl.canvas.height]);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function drawToVelTexture(time){
    gl.useProgram(vel_program);
    gl.enableVertexAttribArray(vel_positionLocation);
    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, quad_positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
      vel_positionLocation, size, type, normalize, stride, offset
    );

    gl.uniform1i(vel_program_postexUniform,0);
    gl.uniform1i(vel_program_veltexUniform,2);
    gl.uniform1f(vel_iTimeUniform,time);
    gl.uniform2fv(vel_iResolution,[gl.canvas.width,gl.canvas.height]);
    gl.uniform2fv(vel_iMouse,[mouseX,mouseY]);
    if(mPos.length>0)gl.uniform2fv(vel_mPos,new Float32Array(mPos));

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  //make a function to update textures
  function updateTextures(gl,time){
    gl.activeTexture(gl.TEXTURE2);
    for(let ii=0; ii<2; ii++){
      setFramebuffer(vel_framebuffers[ii % 2]);
      //------> down here we need code that renders to textures
      drawToVelTexture(time);  
      //for the next draw, use the texture that we've rendered
      gl.bindTexture(gl.TEXTURE_2D, vel_textures[ii % 2]);
    }

    gl.activeTexture(gl.TEXTURE0);
    for(let ii=0; ii<2; ii++){
      setFramebuffer(pos_framebuffers[ii % 2]);
      //------> down here we need code that renders to textures
      drawToPosTexture(time);  
      //for the next draw, use the texture that we've rendered
      gl.bindTexture(gl.TEXTURE_2D, pos_textures[ii % 2]);
    }    
  }

  //A function that draws to screen textures
  function drawToScreenTexture(time){
    gl.useProgram(program);
    // Turn on the position attribute
    gl.enableVertexAttribArray(positionLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
      positionLocation, size, type, normalize, stride, offset
    );

    gl.uniform1i(program_postexUniform,0);
    //gl.uniform1i(program_veltexUniform,2);

    gl.uniform1f(iTimeUniform,time);

    gl.drawArrays(gl.POINTS, 0, PNUM*PNUM);
  }

  //A function to draw trails
  function drawTrails(gl,time){
    for(let ii=0; ii<2; ii++){
      // make this the framebuffer we are rendering to.
      gl.bindFramebuffer(gl.FRAMEBUFFER, trail_framebuffers[ii % 2]);  
      // Tell webgl the viewport setting needed for framebuffer.
      webglUtils.resizeCanvasToDisplaySize(gl.canvas);
      // Tell WebGL how to convert from clip space to pixels
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      //------> down here we need code that renders to textures
      drawScreen();
      drawToScreenTexture(time);
      //for the next draw, use the texture that we've rendered
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, trail_textures[ii % 2]);
    }
    
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); 
    drawScreen();
  }

  //function to draw screen
  function drawScreen(){
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(trail_program);
    gl.enableVertexAttribArray(trail_positionLocation);
    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, quad_positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
      trail_positionLocation, size, type, normalize, stride, offset
    );

    gl.uniform1i(trail_program_texUniform,1);
    gl.uniform1f(trail_opacity,opacity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function drawParticles(gl,time){
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    // render to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(program);

    // Turn on the position attribute
    gl.enableVertexAttribArray(positionLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
      positionLocation, size, type, normalize, stride, offset
    );

    gl.uniform1i(program_postexUniform,0);
    gl.uniform1i(program_veltexUniform,2);
    gl.uniform1f(iTimeUniform,time);

    gl.drawArrays(gl.POINTS, 0, PNUM*PNUM);
  }

  var then = 0;
  var opacity = 0.96;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, posTexture);

  requestAnimationFrame(drawScene);

  function drawScene(time){
    //set time---------------------------------------------
    // convert to seconds
    time *= 0.001;
    // Subtract the previous time from the current time
    var deltaTime = time - then;
    // Remember the current time for the next frame.
    then = time;
    
    //render trails to textures----------------------------
    drawTrails(gl,time);
    //render to textures-----------------------------------
    updateTextures(gl,time);
    //draw particles to canvas-----------------------------
    drawParticles(gl,time);

    //-----------------------------------------------------
    if(mReleased){
      mPos.push(mouseX);
      mPos.push(mouseY);
      mReleased = false;
      if(mPos.length>maxPosLength){
        mPos.shift();
        mPos.shift();
      }
    }

    requestAnimationFrame(drawScene);
  }

  function MousePos(mouseEvent){
    var obj = document.getElementById("c");
    var obj_left = 0;
    var obj_top = 0;
    var xpos;
    var ypos;
    while (obj.offsetParent)
    {
      obj_left += obj.offsetLeft;
      obj_top += obj.offsetTop;
      obj = obj.offsetParent;
    }
    if (mouseEvent)
    {
      //FireFox
      xpos = mouseEvent.pageX;
      ypos = mouseEvent.pageY;
    }
    else
    {
      //IE
      xpos = window.event.x + document.body.scrollLeft - 2;
      ypos = window.event.y + document.body.scrollTop - 2;
    }
    xpos -= obj_left;
    ypos -= obj_top;

    mouseX = xpos;
    mouseY = ypos;
    
  }
  document.getElementById("c").onmousemove = MousePos;

  document.body.onmousedown = function(e) { 
    //mPressed = true;
  }
  document.body.onmouseup = function(e) {
    mReleased = true;
  }

}

main();



//-------------------------------------------------------------
// Fill the buffer with the values that define a quad.
function setGeometry(gl,grid) {
  var positions = new Float32Array(grid);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
}

//-------------------------------------------------------------
function encode(value, scale) {
    var b = 255;
    value = value * scale + b * b / 2;
    var pair = [
        Math.floor((value % b) / b * 255),
        Math.floor(Math.floor(value / b) / b * 255)
    ];
    return pair;
}

function decode(pair, scale) {
    var b = 255;
    return (((pair[0] / 255) * b +
             (pair[1] / 255) * b * b) - b * b / 2) / scale;
}

//-------------------------------------------------------------
function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}