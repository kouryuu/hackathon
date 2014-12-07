(function() {
  var __slice = [].slice;

  self.JSREPLEngine = (function() {
    function JSREPLEngine(input, output, result, error, sandbox, ready) {
      var func, name, _ref;
      this.result = result;
      this.error = error;
      this.sandbox = sandbox;
      this.inspect = this.sandbox.console.inspect;
      this.functionClass = this.sandbox.Function;
      this.sandbox.__eval = this.sandbox["eval"];
      this.compile = this.sandbox.move.compile;
      this.sandbox.move.runtime.print = (function(_this) {
        return function() {
          var objs;
          objs = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
          return output(objs.join(' ') + '\n');
        };
      })(this);
      this.sandbox.move.runtime.read = input;
      _ref = this.sandbox.move.runtime;
      for (name in _ref) {
        func = _ref[name];
        this.sandbox[name] = func;
      }
      ready();
    }

    JSREPLEngine.prototype.Eval = function(command) {
      var e, js, result;
      try {
        js = this.compile(command, {
          wrapSource: false,
          includeRuntime: false
        });
        result = this.sandbox.__eval(js);
        return this.result(result === void 0 ? '' : this.inspect(result));
      } catch (_error) {
        e = _error;
        return this.error(e);
      }
    };

    JSREPLEngine.prototype.EvalSync = function(command) {
      var js;
      js = this.compile(command, {
        wrapSource: false,
        includeRuntime: false
      });
      return this.sandbox.__eval(js);
    };

    JSREPLEngine.prototype.GetNextLineIndent = function(command) {
      var e, js, last_line;
      command = '#pragma enable ehtml\n' + command;
      try {
        js = this.compile(command, {
          wrapSource: false,
          includeRuntime: false
        });
        new this.functionClass(js);
        last_line = command.split('\n').slice(-1)[0];
        if (/^\s+/.test(last_line)) {
          return 0;
        } else {
          return false;
        }
      } catch (_error) {
        e = _error;
        if (/[\[\{\(]$/.test(command)) {
          return 1;
        } else {
          return 0;
        }
      }
    };

    return JSREPLEngine;

  })();

}).call(this);
