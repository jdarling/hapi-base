module.exports = {
  el: function(src, sel){
    if(!sel){
      sel = src;
      src = document;
    }
    return src.querySelector(sel);
  },

  els: function(src, sel){
    if(!sel){
      sel = src;
      src = document;
    }
    return Array.prototype.slice.call(src.querySelectorAll(sel));
  },

  val: function(from){
    return from.value||from.getAttribute('value')||from.innerText||from.innerHTML;
  },

  pkg: function(from){
    var result = {};
    from.forEach(function(e){
      result[e.getAttribute('name')] = val(e);
    });
    return result;
  }  
};
