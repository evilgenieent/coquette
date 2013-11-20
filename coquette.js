;(function(exports) {
  var Coquette = function(game, canvasId, width, height, backgroundColor, autoFocus) {
    var canvas = document.getElementById(canvasId);
    this.renderer = new Coquette.Renderer(this, game, canvas, width, height, backgroundColor);
    this.inputter = new Coquette.Inputter(this, canvas, autoFocus);
    this.entities = new Coquette.Entities(this, game);
    this.runner = new Coquette.Runner(this);
    this.collider = new Coquette.Collider(this);

    var self = this;
    this.ticker = new Coquette.Ticker(this, function(interval) {
      self.collider.update(interval);
      self.runner.update(interval);
      if (game.update !== undefined) {
        game.update(interval);
      }

      self.entities.update(interval)
      self.renderer.update(interval);
      self.inputter.update();
    });
  };

  exports.Coquette = Coquette;
})(this);

;(function(exports) {
  var Collider = function(coquette) {
    this.coquette = coquette;
  };

  // if no entities have uncollision(), skip expensive record keeping for uncollisions
  var isUncollisionOn = function(entities) {
    for (var i = 0, len = entities.length; i < len; i++) {
      if (entities[i].uncollision !== undefined) {
        return true;
      }
    }
    return false;
  };

  var isSetupForCollisions = function(obj) {
    return obj.pos !== undefined && obj.size !== undefined;
  };

  Collider.prototype = {
    _collideRecords: [],

    update: function() {
      var ent = this.coquette.entities.all();
      for (var i = 0, len = ent.length; i < len; i++) {
        for (var j = i + 1; j < len; j++) {
          if (this.isColliding(ent[i], ent[j])) {
            this.collision(ent[i], ent[j]);
          } else {
            this.removeOldCollision(this.getCollideRecordIds(ent[i], ent[j])[0]);
          }
        }
      }
    },

    collision: function(entity1, entity2) {
      var collisionType;
      if (!isUncollisionOn(this.coquette.entities.all())) {
        collisionType = this.INITIAL;
      } else if (this.getCollideRecordIds(entity1, entity2).length === 0) {
        this._collideRecords.push([entity1, entity2]);
        collisionType = this.INITIAL;
      } else {
        collisionType = this.SUSTAINED;
      }

      notifyEntityOfCollision(entity1, entity2, collisionType);
      notifyEntityOfCollision(entity2, entity1, collisionType);
    },

    destroyEntity: function(entity) {
      var recordIds = this.getCollideRecordIds(entity);
      for (var i = 0; i < recordIds.length; i++) {
        this.removeOldCollision(recordIds[i]);
      }
    },

    // remove collision at passed index
    removeOldCollision: function(recordId) {
      var record = this._collideRecords[recordId];
      if (record !== undefined) {
        notifyEntityOfUncollision(record[0], record[1])
        notifyEntityOfUncollision(record[1], record[0])
        this._collideRecords.splice(recordId, 1);
      }
    },

    getCollideRecordIds: function(entity1, entity2) {
      if (entity1 !== undefined && entity2 !== undefined) {
        var recordIds = [];
        for (var i = 0, len = this._collideRecords.length; i < len; i++) {
          if (this._collideRecords[i][0] === entity1 &&
              this._collideRecords[i][1] === entity2) {
            recordIds.push(i);
          }
        }
        return recordIds;
      } else if (entity1 !== undefined) {
        for (var i = 0, len = this._collideRecords.length; i < len; i++) {
          if (this._collideRecords[i][0] === entity1 ||
              this._collideRecords[i][1] === entity1) {
            return [i];
          }
        }
        return [];
      } else {
        throw "You must pass at least one entity when searching collision records."
      }
    },

    isColliding: function(obj1, obj2) {
      return isSetupForCollisions(obj1) && isSetupForCollisions(obj2) &&
        this.isIntersecting(obj1, obj2);
    },

    isIntersecting: function(obj1, obj2) {
      var obj1BoundingBox = obj1.boundingBox || this.RECTANGLE;
      var obj2BoundingBox = obj2.boundingBox || this.RECTANGLE;

      if (obj1BoundingBox === this.RECTANGLE && obj2BoundingBox === this.RECTANGLE) {
        return Maths.rectanglesIntersecting(obj1, obj2);
      } else if (obj1BoundingBox === this.CIRCLE && obj2BoundingBox === this.RECTANGLE) {
        return Maths.circleAndRectangleIntersecting(obj1, obj2);
      } else if (obj1BoundingBox === this.RECTANGLE && obj2BoundingBox === this.CIRCLE) {
        return Maths.circleAndRectangleIntersecting(obj2, obj1);
      } else if (obj1BoundingBox === this.POINT && obj2BoundingBox === this.RECTANGLE) {
        return Maths.pointAndRectangleIntersecting(obj1, obj2);
      } else if (obj1BoundingBox === this.RECTANGLE && obj2BoundingBox === this.POINT) {
        return Maths.pointAndRectangleIntersecting(obj2, obj1);
      } else if (obj1BoundingBox === this.CIRCLE && obj2BoundingBox === this.CIRCLE) {
        return Maths.circlesIntersecting(obj1, obj2);
      } else if (obj1BoundingBox === this.POINT && obj2BoundingBox === this.CIRCLE) {
        return Maths.pointAndCircleIntersecting(obj1, obj2);
      } else if (obj1BoundingBox === this.CIRCLE && obj2BoundingBox === this.POINT) {
        return Maths.pointAndCircleIntersecting(obj2, obj1);
      } else if (obj1BoundingBox === this.POINT && obj2BoundingBox === this.POINT) {
        return Maths.pointsIntersecting(obj1, obj2);
      } else {
        throw "Objects being collision tested have unsupported bounding box types."
      }
    },

    INITIAL: 0,
    SUSTAINED: 1,

    RECTANGLE: 0,
    CIRCLE: 1,
    POINT:2
  };

  var orEqual = function(obj1BB, obj2BB, bBType1, bBType2) {
    return (obj1BB === bBType1 && obj2BB === bBType2) ||
      (obj1BB === bBType2 && obj2BB === bBType1);
  }

  var notifyEntityOfCollision = function(entity, other, type) {
    if (entity.collision !== undefined) {
      entity.collision(other, type);
    }
  };

  var notifyEntityOfUncollision = function(entity, other) {
    if (entity.uncollision !== undefined) {
      entity.uncollision(other);
    }
  };

  var Maths = {
    center: function(obj) {
      if(obj.pos !== undefined) {
        return {
          x: obj.pos.x + (obj.size.x / 2),
          y: obj.pos.y + (obj.size.y / 2),
        };
      }
    },

    circlesIntersecting: function(obj1, obj2) {
      return Maths.distance(Maths.center(obj1), Maths.center(obj2)) <
        obj1.size.x / 2 + obj2.size.x / 2;
    },

    pointAndCircleIntersecting: function(obj1, obj2) {
      return this.distance(obj1.pos, this.center(obj2)) < obj2.size.x / 2;
    },

    pointAndRectangleIntersecting: function(obj1, obj2) {
      return this.pointInsideObj(obj1.pos, obj2);
    },

    pointsIntersecting: function(obj1, obj2) {
      return obj1.pos.x === obj2.pos.x && obj1.pos.y === obj2.pos.y;
    },

    pointInsideObj: function(point, obj) {
      return point.x >= obj.pos.x
        && point.y >= obj.pos.y
        && point.x <= obj.pos.x + obj.size.x
        && point.y <= obj.pos.y + obj.size.y;
    },

    rectanglesIntersecting: function(obj1, obj2) {
      if(obj1.pos.x + obj1.size.x < obj2.pos.x) {
        return false;
      } else if(obj1.pos.x > obj2.pos.x + obj2.size.x) {
        return false;
      } else if(obj1.pos.y > obj2.pos.y + obj2.size.y) {
        return false;
      } else if(obj1.pos.y + obj1.size.y < obj2.pos.y) {
        return false
      } else {
        return true;
      }
    },

    distance: function(point1, point2) {
      var x = point1.x - point2.x;
      var y = point1.y - point2.y;
      return Math.sqrt((x * x) + (y * y));
    },

    rectangleCorners: function(rectangleObj) {
      var corners = [];
      corners.push({ x:rectangleObj.pos.x, y: rectangleObj.pos.y });
      corners.push({ x:rectangleObj.pos.x + rectangleObj.size.x, y:rectangleObj.pos.y });
      corners.push({
        x:rectangleObj.pos.x + rectangleObj.size.x,
        y:rectangleObj.pos.y + rectangleObj.size.y
      });
      corners.push({ x:rectangleObj.pos.x, y: rectangleObj.pos.y + rectangleObj.size.y });
      return corners;
    },

    vectorTo: function(start, end) {
      return {
        x: end.x - start.x,
        y: end.y - start.y
      };
    },

    magnitude: function(vector) {
      return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    },

    dotProduct: function(vector1, vector2) {
      return vector1.x * vector2.x + vector1.y * vector2.y;
    },

    unitVector: function(vector) {
      return {
        x: vector.x / Maths.magnitude(vector),
        y: vector.y / Maths.magnitude(vector)
      };
    },

    closestPointOnSeg: function(linePointA, linePointB, circ_pos) {
      var seg_v = Maths.vectorTo(linePointA, linePointB);
      var pt_v = Maths.vectorTo(linePointA, circ_pos);
      if (Maths.magnitude(seg_v) <= 0) {
        throw "Invalid segment length";
      }

      var seg_v_unit = Maths.unitVector(seg_v);
      var proj = Maths.dotProduct(pt_v, seg_v_unit);
      if (proj <= 0) {
        return linePointA;
      } else if (proj >= Maths.magnitude(seg_v)) {
        return linePointB;
      } else {
        return {
          x: linePointA.x + seg_v_unit.x * proj,
          y: linePointA.y + seg_v_unit.y * proj
        };
      }
    },

    isLineIntersectingCircle: function(circleObj, linePointA, linePointB) {
      var circ_pos = {
        x: circleObj.pos.x + circleObj.size.x / 2,
        y: circleObj.pos.y + circleObj.size.y / 2
      };

      var closest = Maths.closestPointOnSeg(linePointA, linePointB, circ_pos);
      var dist_v = Maths.vectorTo(closest, circ_pos);
      return Maths.magnitude(dist_v) < circleObj.size.x / 2;
    },

    circleAndRectangleIntersecting: function(circleObj, rectangleObj) {
      var corners = Maths.rectangleCorners(rectangleObj);
      return Maths.pointInsideObj(Maths.center(circleObj), rectangleObj) ||
        Maths.isLineIntersectingCircle(circleObj, corners[0], corners[1]) ||
        Maths.isLineIntersectingCircle(circleObj, corners[1], corners[2]) ||
        Maths.isLineIntersectingCircle(circleObj, corners[2], corners[3]) ||
        Maths.isLineIntersectingCircle(circleObj, corners[3], corners[0]);
    },
  };

  exports.Collider = Collider;
  exports.Collider.Maths = Maths;
})(typeof exports === 'undefined' ? this.Coquette : exports);

;(function(exports) {
  var Inputter = function(coquette, canvas, autoFocus) {
    this.coquette = coquette;
    this._keyDownState = {};
    this._keyPressedState = {};
    var self = this;

    // handle whether to autofocus on canvas, or not

    var inputReceiverElement = window;
    if (autoFocus === false) {
      inputReceiverElement = canvas;
      inputReceiverElement.contentEditable = true; // lets canvas get focus and get key events
    } else {
      var suppressedKeys = [
        this.SPACE,
        this.LEFT_ARROW,
        this.UP_ARROW,
        this.RIGHT_ARROW,
        this.DOWN_ARROW
      ];

      // suppress scrolling
      window.addEventListener("keydown", function(e) {
        for (var i = 0; i < suppressedKeys.length; i++) {
          if(suppressedKeys[i] === e.keyCode) {
            e.preventDefault();
            return;
          }
        }
      }, false);
    }

    // set up key listeners

    inputReceiverElement.addEventListener('keydown', function(e) {
      self._keyDownState[e.keyCode] = true;
      if (self._keyPressedState[e.keyCode] === undefined) { // start of new keypress
        self._keyPressedState[e.keyCode] = true; // register keypress in progress
      }
    }, false);

    inputReceiverElement.addEventListener('keyup', function(e) {
      self._keyDownState[e.keyCode] = false;
      if (self._keyPressedState[e.keyCode] === false) { // prev keypress over
        self._keyPressedState[e.keyCode] = undefined; // prep for keydown to start next press
      }
    }, false);
  };

  Inputter.prototype = {
    update: function() {
      for (var i in this._keyPressedState) {
        if (this._keyPressedState[i] === true) { // tick passed and press event in progress
          this._keyPressedState[i] = false; // end key press
        }
      }
    },

    down: function(keyCode) {
      return this._keyDownState[keyCode] || false;
    },

    pressed: function(keyCode) {
      return this._keyPressedState[keyCode] || false;
    },

    BACKSPACE: 8,
    TAB: 9,
    ENTER: 13,
    SHIFT: 16,
    CTRL: 17,
    ALT: 18,
    PAUSE: 19,
    CAPS_LOCK: 20,
    ESC: 27,
    SPACE: 32,
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    END: 35,
    HOME: 36,
    LEFT_ARROW: 37,
    UP_ARROW: 38,
    RIGHT_ARROW: 39,
    DOWN_ARROW: 40,
    INSERT: 45,
    DELETE: 46,
    ZERO: 48,
    ONE: 49,
    TWO: 50,
    THREE: 51,
    FOUR: 52,
    FIVE: 53,
    SIX: 54,
    SEVEN: 55,
    EIGHT: 56,
    NINE: 57,
    A: 65,
    B: 66,
    C: 67,
    D: 68,
    E: 69,
    F: 70,
    G: 71,
    H: 72,
    I: 73,
    J: 74,
    K: 75,
    L: 76,
    M: 77,
    N: 78,
    O: 79,
    P: 80,
    Q: 81,
    R: 82,
    S: 83,
    T: 84,
    U: 85,
    V: 86,
    W: 87,
    X: 88,
    Y: 89,
    Z: 90,
    F1: 112,
    F2: 113,
    F3: 114,
    F4: 115,
    F5: 116,
    F6: 117,
    F7: 118,
    F8: 119,
    F9: 120,
    F10: 121,
    F11: 122,
    F12: 123,
    NUM_LOCK: 144,
    SCROLL_LOCK: 145,
    SEMI_COLON: 186,
    EQUALS: 187,
    COMMA: 188,
    DASH: 189,
    PERIOD: 190,
    FORWARD_SLASH: 191,
    GRAVE_ACCENT: 192,
    OPEN_SQUARE_BRACKET: 219,
    BACK_SLASH: 220,
    CLOSE_SQUARE_BRACKET: 221,
    SINGLE_QUOTE: 222

  };

  Inputter.prototype.state = Inputter.prototype.down;

  exports.Inputter = Inputter;
})(typeof exports === 'undefined' ? this.Coquette : exports);

;(function(exports) {
  function Runner(coquette) {
    this.coquette = coquette;
    this._runs = [];
  };

  Runner.prototype = {
    update: function() {
      this.run();
    },

    run: function() {
      while(this._runs.length > 0) {
        var run = this._runs.shift();
        run.fn(run.obj);
      }
    },

    add: function(obj, fn) {
      this._runs.push({
        obj: obj,
        fn: fn
      });
    }
  };

  exports.Runner = Runner;
})(typeof exports === 'undefined' ? this.Coquette : exports);

;(function(exports) {
  var interval = 16;

  function Ticker(coquette, gameLoop) {
    setupRequestAnimationFrame();

    var nextTickFn;
    this.stop = function() {
      nextTickFn = function() {};
    };

    this.start = function() {
      var prev = new Date().getTime();
      var tick = function() {
        var now = new Date().getTime();
        var interval = now - prev;
        prev = now;
        gameLoop(interval);
        requestAnimationFrame(nextTickFn);
      };

      nextTickFn = tick;
      requestAnimationFrame(nextTickFn);
    };

    this.start();
  };

  // From: https://gist.github.com/paulirish/1579671
  // Thanks Erik, Paul and Tino
  var setupRequestAnimationFrame = function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
      window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
      window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
        || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = function(callback, element) {
        var currTime = new Date().getTime();
        var timeToCall = Math.max(0, interval - (currTime - lastTime));
        var id = window.setTimeout(function() { callback(currTime + timeToCall); },
                                   timeToCall);
        lastTime = currTime + timeToCall;
        return id;
      };
    }

    if (!window.cancelAnimationFrame) {
      window.cancelAnimationFrame = function(id) {
        clearTimeout(id);
      };
    }
  };

  exports.Ticker = Ticker;
})(typeof exports === 'undefined' ? this.Coquette : exports);

;(function(exports) {
  var Maths;
  if(typeof module !== 'undefined' && module.exports) { // node
    Maths = require('./collider').Collider.Maths;
  } else { // browser
    Maths = Coquette.Collider.Maths;
  }

  var Renderer = function(coquette, game, canvas, wView, hView, backgroundColor) {
    this.coquette = coquette;
    this.game = game;
    canvas.style.outline = "none"; // stop browser outlining canvas when it has focus
    canvas.style.cursor = "default"; // keep pointer normal when hovering over canvas
    this._ctx = canvas.getContext('2d');
    this._backgroundColor = backgroundColor;

    canvas.width = wView;
    canvas.height = hView;
    this._viewSize = { x:wView, y:hView };
    this._viewCenterPos = { x: this._viewSize.x / 2, y: this._viewSize.y / 2 };
  };

  Renderer.prototype = {
    getCtx: function() {
      return this._ctx;
    },

    getViewSize: function() {
      return this._viewSize;
    },

    getViewCenterPos: function() {
      return this._viewCenterPos;
    },

    setViewCenterPos: function(pos) {
      this._viewCenterPos = { x:pos.x, y:pos.y };
    },

    update: function(interval) {
      var ctx = this.getCtx();

      var viewTranslate = viewOffset(this._viewCenterPos, this._viewSize);

      // translate so all objs placed relative to viewport
      ctx.translate(-viewTranslate.x, -viewTranslate.y);

      // draw background
      ctx.fillStyle = this._backgroundColor;
      ctx.fillRect(this._viewCenterPos.x - this._viewSize.x / 2,
                   this._viewCenterPos.y - this._viewSize.y / 2,
                   this._viewSize.x,
                   this._viewSize.y);

      // draw game and entities
      var drawables = [this.game]
        .concat(this.coquette.entities.all().concat().sort(zindexSort));
      for (var i = 0, len = drawables.length; i < len; i++) {
        if (drawables[i].draw !== undefined) {
          drawables[i].draw(ctx);
        }
      }

      // translate back
      ctx.translate(viewTranslate.x, viewTranslate.y);
    },

    onScreen: function(obj) {
      return Maths.rectanglesIntersecting(obj, {
        size: this._viewSize,
        pos: {
          x: this._viewCenterPos.x - this._viewSize.x / 2,
          y: this._viewCenterPos.y - this._viewSize.y / 2
        }
      });
    }
  };

  var viewOffset = function(viewCenterPos, viewSize) {
    return {
      x:viewCenterPos.x - viewSize.x / 2,
      y:viewCenterPos.y - viewSize.y / 2
    }
  };

  // sorts passed array by zindex
  // elements with a higher zindex are drawn on top of those with a lower zindex
  var zindexSort = function(a, b) {
    return (a.zindex || 0) < (b.zindex || 0) ? -1 : 1;
  };

  exports.Renderer = Renderer;
})(typeof exports === 'undefined' ? this.Coquette : exports);

;(function(exports) {
  function Entities(coquette, game) {
    this.coquette = coquette;
    this.game = game;
    this._entities = [];
  };

  Entities.prototype = {
    update: function(interval) {
      var entities = this.all();
      for (var i = 0, len = entities.length; i < len; i++) {
        if (entities[i].update !== undefined) {
          entities[i].update(interval);
        }
      }
    },

    all: function(Constructor) {
      if (Constructor === undefined) {
        return this._entities;
      } else {
        var entities = [];
        for (var i = 0; i < this._entities.length; i++) {
          if (this._entities[i] instanceof Constructor) {
            entities.push(this._entities[i]);
          }
        }

        return entities;
      }
    },

    create: function(clazz, settings, callback) {
      var self = this;
      this.coquette.runner.add(this, function(entities) {
        var entity = new clazz(self.game, settings || {});
        entities._entities.push(entity);
        if (callback !== undefined) {
          callback(entity);
        }
      });
    },

    destroy: function(entity, callback) {
      var self = this;
      this.coquette.runner.add(this, function(entities) {
        for(var i = 0; i < entities._entities.length; i++) {
          if(entities._entities[i] === entity) {
            self.coquette.collider.destroyEntity(entity);
            entities._entities.splice(i, 1);
            if (callback !== undefined) {
              callback();
            }
            break;
          }
        }
      });
    }
  };

  exports.Entities = Entities;
})(typeof exports === 'undefined' ? this.Coquette : exports);

