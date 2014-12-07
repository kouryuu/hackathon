(function() {
  self.JSREPLEngine = (function() {
    function JSREPLEngine(unused_input, output, result, error, sandbox, ready) {
      var bufferError;
      this.result = result;
      this.error = error;
      sandbox.print = (function() {});
      this.error_buffer = [];
      this.Lua = sandbox.Lua;
      bufferError = (function(_this) {
        return function(chr) {
          if (chr != null) {
            return _this.error_buffer.push(String.fromCharCode(chr));
          }
        };
      })(this);
      this.Lua.initialize(null, makeUtf8Print(output), bufferError);
      ready();
    }

    JSREPLEngine.prototype.Eval = function(command) {
      var e, result;
      this.error_buffer = [];
      try {
        result = this.Lua["eval"](encodeUtf8(command));
        if (this.error_buffer.length) {
          return this.error(this.error_buffer.join(''));
        } else {
          return this.result(result);
        }
      } catch (_error) {
        e = _error;
        return this.error('Internal error: ' + e);
      }
    };

    JSREPLEngine.prototype.EvalSync = function(command) {
      var result;
      this.error_buffer = [];
      result = this.Lua["eval"](encodeUtf8(command));
      if (this.error_buffer.length) {
        throw this.error_buffer.join('');
      }
      return result;
    };

    JSREPLEngine.prototype.GetNextLineIndent = function(command) {
      if (this.Lua.isFinished(command)) {
        return false;
      } else {
        return 0;
      }
    };

    return JSREPLEngine;

  })();

}).call(this);
