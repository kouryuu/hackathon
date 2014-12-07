(function() {
  self.JSREPLEngine = (function() {
    function JSREPLEngine(input, output, result, error, sandbox, ready) {
      this.input = input;
      this.output = output;
      this.result = result;
      this.error = error;
      this.sandbox = sandbox;
      this.Unlambda = this.sandbox.Unlambda;
      this.result = (function(_this) {
        return function(value) {
          return result(_this.Unlambda.unparse(value));
        };
      })(this);
      ready();
    }

    JSREPLEngine.prototype.Eval = function(command) {
      var e, parsed;
      try {
        parsed = this.Unlambda.parse(command);
      } catch (_error) {
        e = _error;
        this.error(e);
        return;
      }
      return this.Unlambda["eval"](parsed, this.result, this.input, this.output, this.error);
    };

    JSREPLEngine.prototype.EvalSync = function(command) {
      var error, input, parsed, result, ret;
      ret = null;
      parsed = this.Unlambda.parse(command);
      input = function(callback) {
        return callback();
      };
      error = function(error) {
        throw error;
      };
      result = function(res) {
        return ret = res;
      };
      this.Unlambda["eval"](parsed, result, input, this.output, error);
      return ret;
    };

    JSREPLEngine.prototype.GetNextLineIndent = function(command) {
      var e;
      if (/`$/.test(command)) {
        return 0;
      }
      try {
        this.Unlambda.parse(command);
        return false;
      } catch (_error) {
        e = _error;
        return 0;
      }
    };

    return JSREPLEngine;

  })();

}).call(this);
