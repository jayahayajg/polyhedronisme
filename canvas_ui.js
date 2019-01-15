/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Polyhédronisme
//===================================================================================================
//
// A toy for constructing and manipulating polyhedra and other meshes
//
// Copyright 2019, Anselm Levskaya
// Released under the MIT License


// GLOBALS
//===================================================================================================
let ctx={}; // for global access to canvas context
const CANVAS_WIDTH  = 500; //canvas dims
const CANVAS_HEIGHT = 400; //canvas dims
let globPolys={}; // constructed polyhedras

let globRotM = clone(eye3);
let globlastRotM = clone(eye3);
//globtheta = 0 # rotation and projective mapping parameters
//globphi   = 0
let perspective_scale = 800;
const persp_z_max = 5;
const persp_z_min = 0;
const persp_ratio = 0.8;
const _2d_x_offset = CANVAS_WIDTH/2; //300
const _2d_y_offset = CANVAS_HEIGHT/2; //140

const globtime = new Date(); // for animation

const BG_CLEAR = true; // clear background or colored?
const BG_COLOR = "rgba(255,255,255,1.0)"; // background color
const COLOR_METHOD = "signature"; //"area"
let PaintMode = "fillstroke";
const ctx_linewidth = 0.5; // for outline of faces

// Mouse Event Variables
let MOUSEDOWN=false;
let LastMouseX=0;
let LastMouseY=0;
let LastSphVec=[1,0,0]; //for 3d trackball

// random grabbag of polyhedra
const DEFAULT_RECIPES = [
  "C2dakD","oC20kkkT","kn4C40A0dA4","opD",
  "lT","lK5oC","knD","dn6x4K5bT","oox4P7",
  "n18n18n9n9n9soxY9"];

// File-saving objects used to export txt/canvas-png
const saveText = function(text, filename) {
  const blb = new Blob([text], 
    {type: `text/plain;charset=${document.characterSet}`});
  return saveAs(blb, filename);
}

// parses URL string for polyhedron recipe, for bookmarking
// should use #! href format instead
const parseurl = function() {
  let e;
  const urlParams = {};
  const a = /\+/g;  // Regex for replacing addition symbol with a space
  const r = /([^&=]+)=?([^&]*)/g;
  const d = s => decodeURIComponent(s.replace(a, " "));
  const q = window.location.search.substring(1);

  while ((e=r.exec(q))) {
    urlParams[d(e[1])] = d(e[2]);
  }
  return urlParams;
};

// update the shareable link URL with the current recipe and palette
const setlink = function() {
  const specs = $("#spec").val().split(/\s+/g).slice(0, 2);
  // strip any existing parameters
  let link = location.protocol + '//' + location.host + location.pathname;
  link += `?recipe=${encodeURIComponent(specs[0])}`;
  if (PALETTE !== rwb_palette) {
    link += `&palette=${encodeURIComponent(PALETTE.reduce((x,y)=> x+" "+y))}`;
  }
  return $("#link").attr("href", link);
};


// Drawing Functions
//==================================================================================================

// init canvas element
// -------------------------------------------------------------------------------
const init = function() {
  const canvas = $('#poly');
  canvas.width(CANVAS_WIDTH);
  canvas.height(CANVAS_HEIGHT);

  ctx = canvas[0].getContext("2d");
  ctx.lineWidth = ctx_linewidth;

  if (BG_CLEAR) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
    
  const exp = $('#expandcollapse');
  return exp.click(function() {
    if (/minus/.test(exp.attr('src'))) {  // Contains 'minus'
      $('#morestats').hide();
      return exp.attr('src', 'media/plus.png');
    } else {
      $('#morestats').show();      
      return exp.attr('src', 'media/minus.png');
    }
  });
};

// clear canvas
// -----------------------------------------------------------------------------------
const clear = function() {
  if (BG_CLEAR) {
    return ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = BG_COLOR;
    return ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
};


// main drawing routine for polyhedra
//===================================================================================================
const drawpoly = function(poly, tvec) {
  let v;
  if (!tvec) { tvec = [3, 3, 3]; }


  // rotate poly in 3d
  const oldxyz = _.map(poly.xyz, x=> x);
  poly.xyz = _.map(poly.xyz, x=> mv3(globRotM,x));

  // z sort faces
  sortfaces(poly);

  for (let fno = 0; fno < poly.face.length; fno++) {
    var face = poly.face[fno];
    ctx.beginPath();
    // move to first vertex of face
    const v0 = face[face.length-1];
    let [x,y] = perspT(add(tvec,poly.xyz[v0]), persp_z_max,persp_z_min,persp_ratio,perspective_scale);
    ctx.moveTo(x+_2d_x_offset, y+_2d_y_offset);
    // loop around face, defining polygon
    for (v of face) {
      [x,y] = perspT(add(tvec,poly.xyz[v]),persp_z_max,persp_z_min,persp_ratio,perspective_scale);
      ctx.lineTo(x+_2d_x_offset, y+_2d_y_offset);
    }

    // use pre-computed colors
    let clr = palette(poly.face_class[fno]);

    // shade based on simple cosine illumination factor
    const face_verts = ((() => {
      const result = [];
      for (v of face) {
        result.push(poly.xyz[v]);
      }
      return result;
    })());
    const illum = dot(normal(face_verts), unit([1, -1, 0]));
    clr = mult((((illum / 2.0) + 0.5) * 0.7) + 0.3, clr);

    if ((PaintMode === "fill") || (PaintMode === "fillstroke")) {
      ctx.fillStyle = `rgba(${round(clr[0]*255)}, ${round(clr[1]*255)}, ${round(clr[2]*255)}, ${1.0})`;
      ctx.fill();
    // make cartoon stroke (=black) / realistic stroke an option (=below)
      ctx.strokeStyle = `rgba(${round(clr[0]*255)}, ${round(clr[1]*255)}, ${round(clr[2]*255)}, ${1.0})`;
      ctx.stroke();
    }
    if (PaintMode === "fillstroke") {
      ctx.fillStyle = `rgba(${round(clr[0]*255)}, ${round(clr[1]*255)}, ${round(clr[2]*255)}, ${1.0})`;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0, .3)";  // light lines, less cartoony, more render-y
      ctx.stroke();
    }
    if (PaintMode === "stroke") {
      ctx.strokeStyle = "rgba(0,0,0, .8)";
      ctx.stroke();
    }
  }

  // reset coords, for setting absolute rotation, as poly is passed by ref
  return poly.xyz = oldxyz;
};


// draw polyhedra just once
// -----------------------------------------------------------------------------------
const drawShape = function() {
  clear();
  return globPolys.map((p, i) =>
    drawpoly(p,[0+(3*i),0,3]));
};

// update V E F stats on page
// -----------------------------------------------------------------------------------
const updateStats = () =>
  (() => {
    const result = [];
    for (let i = 0; i < globPolys.length; i++) {
      const p = globPolys[i];
      $("#basicstats").text(p.data());
      result.push($("#morestats").text(p.moreData()));
    }
    return result;
  })()
;

// loop for animation
// -----------------------------------------------------------------------------------
var animateShape = function() {
  clear();
  const globtheta=((2*Math.PI)/180.0)*globtime.getSeconds()*0.1;
  for (let i = 0; i < globPolys.length; i++) {
    const p = globPolys[i];
    drawpoly(p,[0+(3*i),0,3]);
  }
  return setTimeout(animateShape, 100);
};


// Initialization and Basic UI
//===================================================================================================

$( function() { //wait for page to load

  // incorrectly added by decaffeinate I believe, shadows these globals:
  // let PALETTE, specs;

  init(); //init canvas

  const urlParams = parseurl(); //see if recipe is spec'd in URL
  if ("recipe" in urlParams) {
    specs=[urlParams["recipe"]];
    $("#spec").val(specs);
  } else {
    specs=[randomchoice(DEFAULT_RECIPES)];
    $("#spec").val(specs);
    setlink();
  }

  // set initial palette spec
  if ("palette" in urlParams) {
    PALETTE = urlParams["palette"].split(/\s+/g);
    setlink();
  }
  $("#palette").val( PALETTE.reduce((x,y)=> x+" "+y) );

  // construct the polyhedra from spec
  globPolys = _.map(specs, x=> newgeneratePoly(x));
  updateStats();

  // draw it
  drawShape();


  // Event Handlers
  // ----------------------------------------------------

  // when spec changes in input, parse and draw new polyhedra
  $("#spec").change(function(e) {
    specs = $("#spec").val().split(/\s+/g).slice(0, 2); //only allow one recipe for now
    globPolys = _.map(specs, x=> newgeneratePoly(x));
    updateStats();
    //animateShape()
    setlink();
    return drawShape();
  });

  // when palette changes in input, redraw polyhedra
  $("#palette").change(function(e) {
    PALETTE = $(this).val().split(/\s+/g);
    setlink();
    return drawShape();
  });

  // Basic manipulation: rotation and scaling of geometry
  // ----------------------------------------------------

  // mousewheel changes scale of drawing
  $("#poly").mousewheel( function(e,delta, deltaX, deltaY){
    e.preventDefault();
    perspective_scale*=(10+delta)/10;
    return drawShape();
  });

  // Implement standard trackball routines
  // ---------------------------------------
  $("#poly").mousedown( function(e){
    e.preventDefault();
    MOUSEDOWN=true;
    LastMouseX=e.clientX-$(this).offset().left; //relative mouse coords
    LastMouseY=e.clientY-($(this).offset().top-$(window).scrollTop());
    //calculate inverse projection of point to sphere
    const tmpvec=invperspT(LastMouseX,LastMouseY,_2d_x_offset,_2d_y_offset,persp_z_max,persp_z_min,persp_ratio,perspective_scale);
    if ((tmpvec[0]*tmpvec[1]*tmpvec[2]*0) === 0) {  //quick NaN check
      LastSphVec=tmpvec;
    }
    return globlastRotM = clone(globRotM); //copy last transform state
  });
  $("#poly").mouseup( function(e){
    e.preventDefault();
    return MOUSEDOWN=false;
  });
  $("#poly").mouseleave( function(e){
    e.preventDefault();
    return MOUSEDOWN=false;
  });
  $("#poly").mousemove( function(e){
    e.preventDefault();
    if (MOUSEDOWN) {
      const MouseX=e.clientX-$(this).offset().left;
      const MouseY=e.clientY-($(this).offset().top-$(window).scrollTop());
      const SphVec=invperspT(MouseX,MouseY,_2d_x_offset,_2d_y_offset,persp_z_max,persp_z_min,persp_ratio,perspective_scale);

      // quick NaN check
      if (((SphVec[0]*SphVec[1]*SphVec[2]*0) === 0) && ((LastSphVec[0]*LastSphVec[1]*LastSphVec[2]*0) === 0)) {
        globRotM = mm3(getVec2VecRotM(LastSphVec,SphVec),globlastRotM);
      }

      return drawShape();
    }
  });

  // State control via some buttons
  // ---------------------------------------

  $("#strokeonly").click(function(e) {
    PaintMode = "stroke";
    return drawShape();
  });
  
  $("#fillonly").click(function(e) {
    PaintMode = "fill";
    return drawShape();
  });
  
  $("#fillandstroke").click(function(e) {
    PaintMode = "fillstroke";
    return drawShape();
  });

  $("#siderot").click(function(e) {
    globRotM = vec_rotm(PI/2,0,1,0);
    return drawShape();
  });
  
  $("#toprot").click(function(e) {
    globRotM = vec_rotm(PI/2,1,0,0);
    return drawShape();
  });

  $("#frontrot").click(function(e) {
    globRotM = rotm(0,0,0);
    return drawShape();
  });

  // Export Options
  // ---------------------------------------
  $("#pngsavebutton").click(function(e){
    const canvas=$("#poly")[0];
    //this works, but is janky
    //window.location = canvas.toDataURL("image/png")
    const spec = $("#spec").val().split(/\s+/g)[0];
    const filename = `polyhedronisme-${spec.replace(/\([^\)]+\)/g, "")}.png`;
    //blobUtil.canvasToBlob(canvas, 'image/png').then(
    //  blob=>saveAs(blob, filename))
    return canvas.toBlobHD(blob => saveAs(blob, filename));
    //return canvas.toBlob( blob=> saveAs(blob, filename));
  });

  $("#objsavebutton").click(function(e){
    const objtxt = globPolys[0].toOBJ();
    const spec = $("#spec").val().split(/\s+/g)[0];
    const filename = `polyhedronisme-${spec.replace(/\([^\)]+\)/g, "")}.obj`;
    return saveText(objtxt,filename);
  });

  return $("#x3dsavebutton").click(function(e){
    const triangulated = triangulate(globPolys[0],true); //triangulate to preserve face_colors for 3d printing
    const x3dtxt = triangulated.toVRML();
    const spec = $("#spec").val().split(/\s+/g)[0];
    //filename = "polyhedronisme-"+spec+".x3d"
    const filename = `polyhedronisme-${spec.replace(/\([^\)]+\)/g, "")}.wrl`;
    return saveText(x3dtxt,filename);
  });
});
