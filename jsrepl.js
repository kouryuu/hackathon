window.__BAKED_JSREPL_BUILD__ = true;
(function() {
  var BASE_PATH, EventEmitter, JSREPL, Loader, SANDBOX_SRC, Sandbox, UA, script_element, workerSupported,
    __slice = [].slice,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  script_element = document.getElementById('jsrepl-script');

  if (script_element != null) {
    BASE_PATH = script_element.src.split('/').slice(0, -1).join('/');
    SANDBOX_SRC = "" + BASE_PATH + "/sandbox.html";
  } else {
    throw new Error('JSREPL script element cannot be found. Make sure you have the ID "jsrepl-script" on it.');
  }

  Loader = (function() {
    function Loader() {
      var loadfn;
      loadfn = (function(_this) {
        return function() {
          _this.head = document.getElementsByTagName('head')[0];
          return _this.body = document.getElementsByTagName('body')[0];
        };
      })(this);
      loadfn();
      this.loadfns = [loadfn];
      window.onload = (function(_this) {
        return function() {
          var fn, _i, _len, _ref, _results;
          _ref = _this.loadfns;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            fn = _ref[_i];
            _results.push(fn());
          }
          return _results;
        };
      })(this);
      this.iframe = null;
    }

    Loader.prototype._appendChild = function(tag, elem) {
      var fn;
      fn = (function(_this) {
        return function() {
          return _this[tag].appendChild(elem);
        };
      })(this);
      if (this[tag] != null) {
        return fn();
      } else {
        return this.loadfns.push(fn);
      }
    };

    Loader.prototype.createSandbox = function(callback) {
      if (this.iframe != null) {
        this.body.removeChild(this.iframe);
      }
      this.iframe = document.createElement('iframe');
      this.iframe.src = SANDBOX_SRC;
      this.iframe.style.display = 'none';
      this.iframe.onload = (function(_this) {
        return function() {
          return callback(_this.iframe.contentWindow);
        };
      })(this);
      return this._appendChild('body', this.iframe);
    };

    return Loader;

  })();

  EventEmitter = (function() {
    function EventEmitter() {
      this.listeners = {};
    }

    EventEmitter.prototype.makeArray = function(obj) {
      if (Object.prototype.toString.call(obj) !== '[object Array]') {
        obj = [obj];
      }
      return obj;
    };

    EventEmitter.prototype.on = function(types, fn) {
      var type, _i, _len, _results;
      if (typeof fn !== 'function') {
        return;
      }
      types = this.makeArray(types);
      _results = [];
      for (_i = 0, _len = types.length; _i < _len; _i++) {
        type = types[_i];
        if (this.listeners[type] == null) {
          _results.push(this.listeners[type] = [fn]);
        } else {
          _results.push(this.listeners[type].push(fn));
        }
      }
      return _results;
    };

    EventEmitter.prototype.off = function(types, fn) {
      var i, listeners, type, _i, _len, _results;
      types = this.makeArray(types);
      _results = [];
      for (_i = 0, _len = types.length; _i < _len; _i++) {
        type = types[_i];
        listeners = this.listeners[type];
        if (listeners == null) {
          continue;
        }
        if (fn != null) {
          i = listeners.indexOf(fn);
          if (i > -1) {
            _results.push(listeners.splice(i, 1));
          } else {
            _results.push(void 0);
          }
        } else {
          _results.push(this.listeners[type] = []);
        }
      }
      return _results;
    };

    EventEmitter.prototype.fire = function(type, args) {
      var f, fn, listeners, _i, _len, _ref, _results;
      args = this.makeArray(args);
      listeners = this.listeners[type];
      if (listeners == null) {
        return;
      }
      args.push(type);
      _ref = (function() {
        var _j, _len, _results1;
        _results1 = [];
        for (_j = 0, _len = listeners.length; _j < _len; _j++) {
          f = listeners[_j];
          _results1.push(f);
        }
        return _results1;
      })();
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        fn = _ref[_i];
        _results.push(fn.apply(this, args));
      }
      return _results;
    };

    EventEmitter.prototype.once = function(types, fn) {
      var cb, type, _i, _len, _results;
      types = this.makeArray(types);
      cb = (function(_this) {
        return function() {
          var args, type, _i, _len;
          args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
          for (_i = 0, _len = types.length; _i < _len; _i++) {
            type = types[_i];
            _this.off(type, cb);
          }
          return fn.apply(null, args);
        };
      })(this);
      _results = [];
      for (_i = 0, _len = types.length; _i < _len; _i++) {
        type = types[_i];
        _results.push(this.on(type, cb));
      }
      return _results;
    };

    return EventEmitter;

  })();

  workerSupported = 'Worker' in window;

  Sandbox = (function(_super) {
    __extends(Sandbox, _super);

    function Sandbox(baseScripts, input_server, listeners) {
      var fn, path, type;
      this.input_server = input_server;
      if (listeners == null) {
        listeners = {};
      }
      this.onmsg = __bind(this.onmsg, this);
      this.baseScripts = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = baseScripts.length; _i < _len; _i++) {
          path = baseScripts[_i];
          _results.push(BASE_PATH + '/' + path);
        }
        return _results;
      })();
      this.loader = new Loader;
      for (type in listeners) {
        fn = listeners[type];
        if (typeof fn === 'function') {
          listeners[type] = [fn];
        }
      }
      this.listeners = listeners;
    }

    Sandbox.prototype.onmsg = function(event) {
      var e, msg;
      try {
        msg = JSON.parse(event.data);
        return this.fire(msg.type, [msg.data]);
      } catch (_error) {
        e = _error;
      }
    };

    Sandbox.prototype.load = function(moreScripts, workerFriendly) {
      var allScripts, base, postCreate;
      if (workerFriendly == null) {
        workerFriendly = true;
      }
      allScripts = this.baseScripts.concat(moreScripts);
      base = allScripts.shift();
      if (this.worker != null) {
        this.kill();
      }
      postCreate = (function(_this) {
        return function() {
          _this.post({
            type: 'importScripts',
            data: allScripts
          });
          if (_this.input_server != null) {
            return _this.post({
              type: 'set_input_server',
              data: _this.input_server
            });
          }
        };
      })(this);
      window.removeEventListener('message', this.onmsg, false);
      if (!workerSupported || !workerFriendly) {
        return this.loader.createSandbox((function(_this) {
          return function(sandbox) {
            _this.worker = sandbox;
            _this.workerIsIframe = true;
            window.addEventListener('message', _this.onmsg, false);
            return postCreate();
          };
        })(this));
      } else {
        this.worker = new Worker(base);
        this.workerIsIframe = false;
        this.worker.addEventListener('message', this.onmsg, false);
        return postCreate();
      }
    };

    Sandbox.prototype.post = function(msgObj) {
      var msgStr;
      msgStr = JSON.stringify(msgObj);
      if (!this.workerIsIframe) {
        return this.worker.postMessage(msgStr);
      } else {
        return this.worker.postMessage(msgStr, '*');
      }
    };

    Sandbox.prototype.kill = function() {
      var _base;
      if (typeof (_base = this.worker).terminate === "function") {
        _base.terminate();
      }
      if ((this.loader.body != null) && this.loader.iframe) {
        this.loader.body.removeChild(this.loader.iframe);
        return delete this.loader['iframe'];
      }
    };

    return Sandbox;

  })(EventEmitter);

  UA = (function() {
    var UA_REGEXS, ua, ua_regex;
    UA_REGEXS = {
      firefox_3: /firefox\/3/i,
      opera: /opera/i,
      chrome: /chrome/i
    };
    for (ua in UA_REGEXS) {
      ua_regex = UA_REGEXS[ua];
      if (ua_regex.test(window.navigator.userAgent)) {
        return ua;
      }
    }
  })();

  JSREPL = (function(_super) {
    __extends(JSREPL, _super);

    function JSREPL(_arg) {
      var baseScripts, db, error, input, input_server, output, progress, result, _ref;
      _ref = _arg != null ? _arg : {}, result = _ref.result, error = _ref.error, input = _ref.input, output = _ref.output, progress = _ref.progress, this.timeout = _ref.timeout, input_server = _ref.input_server;
      this.getLangConfig = __bind(this.getLangConfig, this);
      this.rawEval = __bind(this.rawEval, this);
      this["eval"] = __bind(this["eval"], this);
      this.checkLineEnd = __bind(this.checkLineEnd, this);
      this.loadLanguage = __bind(this.loadLanguage, this);
      this.off = __bind(this.off, this);
      this.on = __bind(this.on, this);
      JSREPL.__super__.constructor.call(this);
      if (window.openDatabase != null) {
        db = openDatabase('replit_input', '1.0', 'Emscripted input', 1024);
        db.transaction(function(tx) {
          tx.executeSql('DROP TABLE IF EXISTS input');
          return tx.executeSql('CREATE TABLE input (text)');
        });
      }
      if (input_server == null) {
        input_server = {};
      }
      input_server.input_id = Math.floor(Math.random() * 9007199254740992) + 1;
      this.lang = null;
      this.on('input', input);
      baseScripts = ['sandbox.js'];
      if (!window.__BAKED_JSREPL_BUILD__) {
        baseScripts = baseScripts.concat(['util/polyfills.js', 'util/mtwister.js']);
      }
      this.sandbox = new Sandbox(baseScripts, input_server, {
        output: output,
        input: (function(_this) {
          return function() {
            return _this.fire('input', function(data) {
              return _this.sandbox.post({
                type: 'input.write',
                data: data
              });
            });
          };
        })(this),
        error: error,
        result: result,
        progress: progress,
        db_input: (function(_this) {
          return function() {
            return _this.fire('input', function(data) {
              _this.sandbox.fire('recieved_input', [data]);
              return db.transaction(function(tx) {
                return tx.executeSql("INSERT INTO input (text) VALUES ('" + data + "')", []);
              });
            });
          };
        })(this),
        server_input: (function(_this) {
          return function() {
            return _this.fire('input', function(data) {
              var url, xhr;
              _this.sandbox.fire('recieved_input', [data]);
              url = (input_server.url || '/emscripten/input/') + input_server.input_id;
              if (input_server.cors) {
                xhr = new XMLHttpRequest();
                if ('withCredentials' in xhr) {
                  xhr.open('POST', url, true);
                } else if (typeof XDomainRequest !== "undefined" && XDomainRequest !== null) {
                  xhr = new XDomainRequest();
                  xhr.open('POST', url);
                } else {
                  throw new Error('CORS not supported on your browser');
                }
              } else {
                xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);
              }
              xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
              return xhr.send("input=" + data);
            });
          };
        })(this)
      });
    }

    JSREPL.prototype.on = function(types, fn) {
      var type, _i, _len, _results;
      types = this.makeArray(types);
      _results = [];
      for (_i = 0, _len = types.length; _i < _len; _i++) {
        type = types[_i];
        if (type === 'input') {
          _results.push(JSREPL.__super__.on.call(this, 'input', fn));
        } else {
          _results.push(this.sandbox.on(type, fn));
        }
      }
      return _results;
    };

    JSREPL.prototype.off = function(types, fn) {
      var type, _i, _len, _results;
      types = this.makeArray(types);
      _results = [];
      for (_i = 0, _len = types.length; _i < _len; _i++) {
        type = types[_i];
        if (type === 'input') {
          _results.push(JSREPL.__super__.off.call(this, 'input', fn));
        } else {
          _results.push(this.sandbox.off(type, fn));
        }
      }
      return _results;
    };

    JSREPL.prototype.loadLanguage = function(lang_name, loadInWorker, callback) {
      var lang_scripts, script, _ref;
      if (typeof loadInWorker === 'function') {
        _ref = [loadInWorker, void 0], callback = _ref[0], loadInWorker = _ref[1];
      }
      if (JSREPL.prototype.Languages.prototype[lang_name] == null) {
        throw new Error("Language " + lang_name + " not supported.");
      }
      this.current_lang_name = lang_name;
      this.lang = JSREPL.prototype.Languages.prototype[lang_name];
      if (callback != null) {
        this.sandbox.once('ready', callback);
      }
      lang_scripts = (function() {
        var _i, _len, _ref1, _results;
        _ref1 = this.lang.scripts;
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          script = _ref1[_i];
          if (typeof script === 'object') {
            _results.push(script[UA] || script['default']);
          } else {
            _results.push(script);
          }
        }
        return _results;
      }).call(this);
      return this.sandbox.load(lang_scripts.concat([this.lang.engine]), loadInWorker);
    };

    JSREPL.prototype.checkLineEnd = function(command, callback) {
      if (/\n\s*$/.test(command)) {
        return callback(false);
      } else {
        this.sandbox.once('indent', callback);
        return this.sandbox.post({
          type: 'getNextLineIndent',
          data: command
        });
      }
    };

    JSREPL.prototype["eval"] = function(command, callback) {
      var bind, cb, listener, t, unbind;
      if (!this.sandbox.workerIsIframe && (this.timeout != null) && this.timeout.time && this.timeout.callback) {
        t = null;
        cb = (function(_this) {
          return function() {
            var a;
            _this.sandbox.fire('timeout');
            a = _this.timeout.callback();
            if (!a) {
              return t = setTimeout(cb, _this.timeout.time);
            } else {
              return unbind();
            }
          };
        })(this);
        t = setTimeout(cb, this.timeout.time);
        listener = (function(_this) {
          return function() {
            var args, type, _i;
            args = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), type = arguments[_i++];
            clearTimeout(t);
            if (type === 'input') {
              _this.once('recieved_input', function() {
                return t = setTimeout(cb, _this.timeout.time);
              });
              return bind();
            }
          };
        })(this);
        bind = (function(_this) {
          return function() {
            return _this.once(['result', 'error', 'input'], listener);
          };
        })(this);
        unbind = (function(_this) {
          return function() {
            return _this.off(['result', 'error', 'input'], listener);
          };
        })(this);
        bind();
      }
      if (typeof callback === 'function') {
        this.once(['result', 'error'], (function(_this) {
          return function() {
            var args, type, _i;
            args = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), type = arguments[_i++];
            if (type === 'error') {
              return callback(args[0], null);
            } else {
              return callback(null, args[0]);
            }
          };
        })(this));
      }
      return this.sandbox.post({
        type: 'engine.Eval',
        data: command
      });
    };

    JSREPL.prototype.rawEval = function(command) {
      return this.sandbox.post({
        type: 'engine.RawEval',
        data: command
      });
    };

    JSREPL.prototype.getLangConfig = function(lang_name) {
      return JSREPL.prototype.Languages.prototype[lang_name || this.current_lang_name] || null;
    };

    return JSREPL;

  })(EventEmitter);

  JSREPL.prototype.Languages = (function() {
    function Languages() {}

    return Languages;

  })();

  JSREPL.prototype.__test__ = (function() {
    function __test__() {}

    return __test__;

  })();

  JSREPL.prototype.__test__.prototype.Loader = Loader;

  JSREPL.prototype.__test__.prototype.EventEmitter = EventEmitter;

  JSREPL.prototype.__test__.prototype.Sandbox = Sandbox;

  this.JSREPL = JSREPL;

}).call(this);
;
JSREPL.prototype.Languages.prototype={"qbasic":{"system_name":"qbasic","name":"Quick Basic","extension":"bas","matchings":[],"scripts":[{"default":["engines/qbasic-default.js"]}],"includes":[],"engine":"langs/qbasic/jsrepl_qbasic.js","minifier":"closure"},"scheme":{"system_name":"scheme","name":"Scheme","extension":"scm","matchings":[["(",")"],["[","]"]],"scripts":[{"default":["engines/scheme-default.js"]}],"includes":[],"engine":"langs/scheme/jsrepl_scheme.js","minifier":"closure_es5"},"apl":{"system_name":"apl","name":"APL","extension":"apl","matchings":[["(",")"],["[","]"],["{","}"]],"scripts":[{"default":["engines/apl-default.js"]}],"includes":[],"engine":"langs/apl/jsrepl_apl.js","minifier":"yui"},"javascript":{"system_name":"javascript","name":"JavaScript","extension":"js","matchings":[["(",")"],["[","]"],["{","}"]],"scripts":[{"default":["engines/javascript-default.js"]}],"includes":[],"engine":"langs/javascript/jsrepl_js.js","minifier":"closure"},"coffeescript":{"system_name":"coffeescript","name":"CoffeeScript","extension":"coffee","matchings":[["(",")"],["[","]"],["{","}"]],"scripts":[{"default":["engines/coffeescript-default.js"]}],"includes":[],"engine":"langs/coffee-script/jsrepl_coffee.js","minifier":"uglify"},"brainfuck":{"system_name":"brainfuck","name":"Brainfuck","extension":"bf","matchings":[["[","]"]],"scripts":[{"default":["engines/brainfuck-default.js"]}],"includes":[],"engine":"langs/brainfuck/jsrepl_brainfuck.js","minifier":"closure"},"unlambda":{"system_name":"unlambda","name":"Unlambda","extension":"unl","matchings":[],"scripts":[{"default":["engines/unlambda-default.js"]}],"includes":[],"engine":"langs/unlambda/jsrepl_unlambda.js","minifier":"closure"},"lolcode":{"system_name":"lolcode","name":"LOLCODE","extension":"lol","matchings":[],"scripts":[{"default":["engines/lolcode-default.js"]}],"includes":[],"engine":"langs/lolcode/jsrepl_lolcode.js","minifier":"closure"},"kaffeine":{"system_name":"kaffeine","name":"Kaffeine","extension":"k","matchings":[["(",")"],["[","]"],["{","}"]],"scripts":[{"default":["engines/kaffeine-default.js"]}],"includes":[],"engine":"langs/kaffeine/jsrepl_kaffeine.js","minifier":"closure"},"move":{"system_name":"move","name":"Move","extension":"mv","matchings":[["(",")"],["[","]"],["{","}"]],"scripts":[{"default":["engines/move-default.js"]}],"includes":[],"engine":"langs/move/jsrepl_move.js","minifier":"closure"},"traceur":{"system_name":"traceur","name":"Traceur","extension":"js","matchings":[["(",")"],["[","]"],["{","}"]],"scripts":[{"default":["engines/traceur-default.js"]}],"includes":[],"engine":"langs/traceur/jsrepl_traceur.js","minifier":"closure_es5"},"emoticon":{"system_name":"emoticon","name":"Emoticon","extension":"emo","matchings":[["(",")"]],"scripts":[{"default":["engines/emoticon-default.js"]}],"includes":[],"engine":"langs/emoticon/jsrepl_emoticon.js","minifier":"closure"},"bloop":{"system_name":"bloop","name":"Bloop/Floop","extensions":"bloop","matchings":[],"scripts":[{"default":["engines/bloop-default.js"]}],"includes":[],"engine":"langs/bloop/jsrepl_bloop.js","minifier":"closure"},"forth":{"system_name":"forth","name":"Forth","extensions":"4th","matchings":[["(",")"],[":",";"]],"scripts":[{"default":["engines/forth-default.js"]}],"includes":[],"engine":"langs/forth/jsrepl_forth.js","minifier":"closure"},"lua":{"system_name":"lua","name":"Lua","extension":"lua","matchings":[["(",")"],["[","]"],["{","}"]],"scripts":[{"default":["engines/lua-default.js"]}],"includes":[],"engine":"langs/lua/jsrepl_lua.js","minifier":"none","emscripted":true},"python":{"system_name":"python","name":"Python","extension":"py","matchings":[["(",")"],["[","]"],["{","}"]],"scripts":[{"opera":["engines/python-opera.js"],"default":["engines/python-default.js"]}],"includes":["extern/python/unclosured","extern/python/closured","extern/python/reloop-closured"],"engine":"langs/python/jsrepl_python.js","minifier":"none","emscripted":true},"ruby":{"system_name":"ruby","name":"Ruby","extension":"rb","matchings":[["(",")"],["[","]"],["{","}"]],"scripts":[{"opera":["engines/ruby-opera.js"],"firefox_3":["engines/ruby-firefox_3.js"],"default":["engines/ruby-default.js"]}],"includes":["extern/ruby/dist/lib"],"engine":"langs/ruby/jsrepl_ruby.js","minifier":"none","emscripted":true},"roy":{"system_name":"roy","name":"Roy","extension":"roy","matchings":[["(",")"],["[","]"],["{","}"]],"scripts":[{"default":["engines/roy-default.js"]}],"includes":[],"engine":"langs/roy/jsrepl_roy.js","minifier":"closure"}}