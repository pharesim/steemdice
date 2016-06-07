var bank = 'soupper0';
var server = 'wss://steemit.com/ws';
var houseedge = 0.01;
var maxwin = 10;

//global
var steem = {};
var blocks = [];
var doneblocks = {};


// main function
$( document ).ready(function() {
  $("#houseEdge").text(houseedge * 100);
  $("#maxWin").text(maxwin);

  ws = new WebSocketWrapper(server);
  ws.connect().then(function(response) {
    steem = new SteemWrapper(ws);
    proceed();
  }, function(error) { alert(error) });
});


//requests
var proceed = function() {
  repeatedRequests();
  setInterval(
    function(){
      repeatedRequests();
    },
    3000
  );
}

var repeatedRequests = function() {
  steem.send('get_dynamic_global_properties',[], function(response) {
    newProperties(response);
  });
  steem.send('call',[0,'get_state',['/@'+bank+'/transfers']], function(response) {
    newBankState(response);
  });
}


//workers
var newProperties = function(data) {
  var block = data['head_block_number'];
  var hash = data['head_block_id'];
  $('#lastBlockHeight').html(block);
  $('#lastBlockId').html(hash);
  var goal = calculateGoal(hash,block);
  if(goal == false) {
    goal = 'Invalid';
  }
  $('#lastBlockGoal').html(goal);
}

var newBankState = function(data) {
  var table = $('#txTable');
  data['accounts'][bank]['transfer_history'].forEach(function(tx){
    // only proceed for transfers to the bank which are at least a block old
    if(tx[1]['op'][0] == 'transfer' && tx[1]['op'][1]['from'] != bank && tx[1]['block'] < $('#lastBlockHeight').html()) {
      // only proceed if row hasn't been added yet
      if(!$("#bet"+tx[1]['block']+tx[1]['trx_in_block']).length) {
        try {
          var memo = JSON.parse(tx[1]['op'][1]['memo']);
        }
        catch(err) {
          var memo = {}
        }
        var type = '';
        var bet = '';
        if(typeof memo['type'] !== 'undefined') {
          if(memo['type'] == 'higher') {
            type = '>';
          } else if(memo['type'] == 'lower') {
            type = '<';
          }
          bet = '<span class="betType">'+type+'</span> <span class="betNumber">'+escapeHtml(memo['number'])+'</span>';
          table.prepend(
            '<tr id="bet'+tx[1]['block']+tx[1]['trx_in_block']+'"><td>'+
            timesince(Date.parse(tx[1]['timestamp']))+' ago</td><td>'+tx[1]['block']+'</td><td>'+
            tx[1]['op'][1]['from']+'</td><td>'+tx[1]['op'][1]['amount']+'</td><td>'+
            bet+'</td><td class="result'+tx[1]['block']+'">'+bet+'</td><td></td></tr>'
          );

          getBlock(tx[1]['block']);
        }
      }

      if($('#bet'+tx[1]['block']+tx[1]['trx_in_block']+' .result'+tx[1]['block']).hasClass('won') === false &&
        !$('#bet'+tx[1]['block']+tx[1]['trx_in_block']+' .result'+tx[1]['block']).hasClass('lost') === false
      ) {
         getBlock(tx[1]['block']);
      }
    }
  });
}

var getBlock = function(block) {
  if(typeof doneblocks['"'+block+'"'] === 'undefined') {
    if(typeof blocks[block] !== 'undefined') {
      newBlock(block,blocks[block]);
    } else {
      steem.send('get_block',[block+1], function(response) {
        processBlock(block,response);
      });
    }
  }
}

var processBlock = function(block, data) {
  if(typeof data['previous'] !== 'undefined') {
    blocks[block] = data['previous'];
    newBlock(block,data['previous']);
  };
}

var newBlock = function(block,hash) {
  var goal = calculateGoal(hash);
  if(goal == false) {
    var next = block+1;
    $(".result"+block).addClass('result'+next);
    doneblocks['"'+block+'"'] = 1;
    getBlock(next);
    return false;
  }
  $('.result'+block).text(goal);
  var type = $('.result'+block).prev().children('.betType').html();
  var number = $('.result'+block).prev().children('.betNumber').html();
  var won = 0;
  var factor = 100;
  var invalidBet = 0;
  if(type == '&gt;') {
    factor = 100-number;
    if(number < goal) {
      won = 1;
    }
  } else if(type == '&lt;') {
    factor = 0+number;
    if(number > goal) {
      won = 1;
    }
  }

  if(won == 1) {
    $('.result'+block).addClass('won');
  } else {
    $('.result'+block).addClass('lost');
  }

  if(factor > 0 && factor < 100) {
    var amount = $('.result'+block).prev().prev().text();
    var asset = amount.substring(amount.length-5,amount.length);
    var tmp = amount.substring(0,amount.length-6);
    var win = Math.round((tmp * 100000 / (factor*1000))*1000)/1000;
    var cssClass = 'lost';
    var hide = 0;
    if(win > maxwin) {
      win = 'Bet too high';
      hide = 1;
      if(won == 0) {
        cssClass = 'won';
      }
    } else if(won == 1) {
      cssClass = 'won';
      win = Math.round(win*1000 * (1-houseedge)) / 1000+' '+asset;
    } else if(won == 0) {
      win = '';
    }
  } else {
    win = 'Invalid bet';
    hide = 1;
    cssClass = 'won';
  }

  $('.result'+block).next().addClass(cssClass).text(win);
  if(hide == 1) {
    $('.result'+block).parent().hide();
  }

  doneblocks['"'+block+'"'] = 1;
}

// calculate the result for a block hash
var calculateGoal = function(hash) {
  var end = hash.substring(hash.length-5,hash.length);
  var target = parseInt(end, 16);
  if(target > 999999) {
    return false;
  }

  return (target%10000)/100;
}


// escape HTML
var entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': '&quot;',
  "'": '&#39;',
  "/": '&#x2F;'
};

function escapeHtml(string) {
  return String(string).replace(/[&<>"'\/]/g, function (s) {
    return entityMap[s];
  });
}


// time ago
function timesince(date) {
  var seconds = Math.floor((new Date() - date) / 1000);
  var interval = Math.floor(seconds / 31536000);

  if (interval > 1) {
    return interval + " years";
  }
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) {
    return interval + " months";
  }
  interval = Math.floor(seconds / 86400);
  if (interval > 1) {
    return interval + " days";
  }
  interval = Math.floor(seconds / 3600);
  if (interval > 1) {
    return interval + " hours";
  }
  interval = Math.floor(seconds / 60);
  if (interval > 1) {
    return interval + " minutes";
  }
  return Math.floor(seconds) + " seconds";
}
