var SteemWrapper;
SteemWrapper = (function() {
  var steem = SteemWrapper.prototype;

  function SteemWrapper(ws) {
    this.ws = ws
    this.id = 0;
  }

  steem.send = function(method, params, callback) {
    ++this.id;
    var data = {
      "id": this.id,
      "method": method,
      "params": params
    }
    this.ws.send(data, callback);
  }

  return SteemWrapper;
})();

