(function() {
  var __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  self.JSREPLEngine = (function() {
    function JSREPLEngine(input, output, result, error, sandbox, ready) {
      var f;
      this.input = input;
      this.output = output;
      this.result = result;
      this.error = error;
      this.sandbox = sandbox;
      this.ready = ready;
      f = function() {
        throw Error('I/O is not supported');
      };
      this.ws = this.sandbox.apl.ws({
        "in": f,
        out: f
      });
      this.ready();
    }

    JSREPLEngine.prototype.Eval = function(command) {
      var e, r, _ref;
      try {
        r = (_ref = this.ws(command)) != null ? _ref.toString() : void 0;
        return this.result(r == null ? '' : __indexOf.call(r, '\n') >= 0 ? '\n' + r : r);
      } catch (_error) {
        e = _error;
        return this.error(e);
      }
    };

    JSREPLEngine.prototype.GetNextLineIndent = function(command) {
      return false;
    };

    return JSREPLEngine;

  })();

}).call(this);
