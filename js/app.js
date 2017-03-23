var bank = 'steemdice1';
var server = 'wss://node.steem.ws/';
var houseedge = 0.01;
var maxwin_steem = 10;
var maxwin_sbd = 10;

//global
//var steem = {};
var blocks = [];
var doneblocks = {};

var updateInterval = 3000;

var bankroll_sbd = 0;
var bankroll_steem = 0;
var playing_with = 'sbd';
var loggedIn = false;
var user = '';
var pub = '';
var wif = '';

// main function
$( document ).ready(function() {
  $("#houseEdge").text(houseedge * 100);

  $(".play_with_steem").hide();
  $("#switch_to_sbd, #switch_to_steem").click(function(e){
    e.preventDefault();
    $(".play_with_sbd, .play_with_steem").toggle();
    if(playing_with == 'sbd') {
      playing_with = 'steem';
    } else {
      playing_with = 'sbd';
    }
  });

  $('#double_bet').click(function(e){
    e.preventDefault();
    if(loggedIn == false) {
      $("#login_modal").addClass('is-toggled');
    } else {
      let oldbet = $('#bet_amount').val();
      $("#bet_amount").val(oldbet*2);
      $("#bet_amount").change();
    }
  });

  $("#bet_amount").change(function(e){
    let betAmount = $(this).val();
    let bankroll = window['bankroll_' + playing_with];
    let diff = bankroll - betAmount;
    if(diff < 0) {
      betAmount = bankroll;
    }

    betAmount = String(betAmount);
    betAmount = betAmount.replace(',','.');
    let check = betAmount.split('.');
    betAmount = check[0]
    if(check[1] !== undefined) {
      if(check[1].length > 3) {
        check[1] = check[1].substring(0,3);
      }
      betAmount = betAmount+"."+check[1];
    }
    
    $(this).val(betAmount);
    calculateWin();
  });

  $("#bet_chance").change(function(e){
    calculateWin();
  });

  $("#login_button").click(function(e){
    e.preventDefault();
    login();
  });
  $("#logout").click(function(e){
    e.preventDefault();
    logout();
  });

  // Generic Toggle
  // Add .is-toggled to target element
  $("[data-toggle]").click(function() {
    id = $(this).data("toggle");
    $("#" + id).toggleClass("is-toggled");
  }).children().click(function(e) {
    return false;
  });

  $("#roll").click(function(){
    if(loggedIn == false) {
      $("#login_modal").addClass('is-toggled');
    } else {
      $("#roll").hide();
      $("#rolling").show();
      let amount = $("#bet_amount").val();
      let split = amount.split('.');
      if(split[1] === undefined) {
        split[1] = '000';
      }
      let decimals = split[1].length;
      if(decimals < 3) {
        for(i = 3; i > decimals; i--) {
          split[1] = split[1]+'0';
        }
      }
      if(split[1].length > 3) {
        split[1] = split[1].substring(0,3);
      }
      amount = split[0]+'.'+split[1];
      if(playing_with == 'sbd') {
        amount = amount+' SBD';
      }
      if(playing_with == 'steem') {
        amount = amount+' STEEM';
      }
      steem.broadcast.transfer(wif, user, bank, amount, '{"type":"lower","number":'+$("#bet_chance").val()+'}', function(err, result) {
        $("#rolling").hide();
        $("#rolled").show();
        updateUser();
        setTimeout(
          function(){
            $("#rolled").hide();
            $("#roll").show();
          },
          2000
        );
      });
    }
  });

  proceed();
});


var calculateWin = function() {
  let amount = $("#bet_amount").val();
  let chance = $("#bet_chance").val();
  if(chance < 1) {
    chance = 1;
  }
  if(chance > 99) {
    chance = 99;
  }
  $("#bet_chance").val(chance);
  let factor = 100/chance;
  let win = (amount * factor) * (1 - houseedge);
  let maxwin = window['maxwin_'+playing_with];
  if(win > maxwin) {
      win = maxwin;
      if(amount >= maxwin) {
        amount = maxwin / 2;
      }
      factor = (win/(1-houseedge))/amount;
      
      chance = 100/factor;
      $("#bet_amount").val(Math.round(amount*1000)/1000);
      $("#bet_chance").val(Math.round(chance*100)/100);
      win = (amount * factor) * (1 - houseedge);
  }
  $("#potential_win").text(Math.round(win*1000)/1000);
}

var login = function() {
  loginBusy();
  user = $("#username").val();
  var pass = $("#password").val();

  if(steem.auth.isWif(pass)) {
    key = pass;
  } else {
    key = steem.auth.toWif(user, pass, 'active');
  }

  pub = steem.auth.wifToPublic(key);
  steem.api.getAccounts([user],function(err,result){
    var threshold = result[0]['active']['weight_threshold'];
    var auths = result[0]['active']['key_auths'];
    for(var i = 0; i < auths.length; i++) {
      if(auths[i][1] >= threshold && auths[i][0] == pub) {
        loggedIn = true;
        wif = key;
        loggedInToggle();
        $("#login_error").hide();
        $("#login_modal").removeClass('is-toggled');
        updateUser();
      }
    }

    if(loggedIn == false) {
      $("#login_error").show();
      user = '';
      pub = '';
      wif = '';
    }

    $("#password").val("");
    loginBusy();
  });
}

var updateUser = function() {
  if(user != '') {
    steem.api.getAccounts([user],function(err,result){
      setBankroll('SBD',result[0]['sbd_balance']);
      setBankroll('STEEM',result[0]['balance']);
    });
  }
}

var loginBusy = function() {
  $("#login_button").toggle();
  $("#busy_indicator").toggle();
}

var loggedInToggle = function() {
  $(".username").text(user);
  $("#login_link").toggle();
  $("#logged_in_message").toggle();
}

var logout = function() {
  user = '';
  pub = '';
  wif = '';
  loggedIn = false;
  loggedInToggle();
}

var setBankroll = function(coin,value) {
  let old_bankroll = 0;
  let new_bankroll = 0;
  if(coin == 'SBD') {
    tmp = bankroll_sbd;
    $("#bankroll_sbd").text(value);
    bankroll_sbd = value.slice(0,-4);
    if(playing_with == 'sbd') {
      old_bankroll = tmp;
      new_bankroll = bankroll_sbd;
    }
  }

  if(coin == 'STEEM') {
    tmp = bankroll_steem;
    $("#bankroll_steem").text(value);
    bankroll_steem = value.slice(0,-6);
    if(playing_with == 'steem') {
      old_bankroll = tmp;
      new_bankroll = bankroll_steem;
    }
  }

  let change = new_bankroll - old_bankroll;
  if(old_bankroll != 0 && change != 0) {
    let sign = '+';
    if(change < 0) {
      change = change * -1;
      sign = '-';
    }
    bankrollModified(sign,change);
  }
}

//requests
var proceed = function() {
  repeatedRequests();
  setInterval(
    function(){
      repeatedRequests();
    },
    updateInterval
  );
}

var repeatedRequests = function() {
  steem.api.getDynamicGlobalProperties(function(err, result) {
    newProperties(result);
  });
  steem.api.getState('/@'+bank+'/transfers', function(err, result) {
    newBankState(result);
  });

  updateUser();
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
  var history = data['accounts'][bank]['transfer_history'];
  var amount = history.length;
  for(i = amount - 26; i < amount; i++) {
    tx = history[i];
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
          bet = '<span class="betAmount">'+tx[1]['op'][1]['amount']+'</span> <span class="betType">'+type+'</span> <span class="betNumber">'+escapeHtml(memo['number'])+'</span>';
          table.prepend(
            '<tr id="bet'+tx[1]['block']+tx[1]['trx_in_block']+'"><td data-timestamp="'+Date.parse(tx[1]['timestamp'])+'">'+
            timesince(Date.parse(tx[1]['timestamp']))+' ago</td><td>'+tx[1]['block']+'</td><td>'+
            tx[1]['op'][1]['from']+'</td><td style="display: none;">'+bet+'</td><td class="result'+tx[1]['block']+'">'+bet+'</td></tr>'
          );
        }
      }
      getBlock(tx[1]['block']);
    }
  }
}

var getBlock = function(block) {
  if(typeof doneblocks['"'+block+'"'] === 'undefined') {
    if(typeof blocks[block] !== 'undefined') {
      newBlock(block,blocks[block]);
    } else {
      steem.api.getBlock(block+1, function(err, result) {
        processBlock(block,result);
      });
    }
  } else if(doneblocks['"'+block+'"'] == 1) {
    $('.result'+block).each(function() {
      var elem = $(this).parent().children(':first');
      var value = elem.data('timestamp');
      elem.text(timesince(value)+' ago');
    });
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
  doneblocks['"'+block+'"'] = 1;
  if(goal == false) {
    var next = block+1;
    $(".result"+block).addClass('result'+next);
    doneblocks['"'+block+'"'] = 2;
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

  var hide = 0;
  if(factor > 0 && factor < 100) {
    var amount = $('.result'+block).prev().children('.betAmount').text();
    var asset = amount.substring(amount.length-5,amount.length);
    if(asset.substring(1,2) == ' ') {
      asset = asset.substring(2);
    }
    var tmp = amount.substring(0,amount.length-6);
    var win = Math.round((tmp * 100000 / (factor*1000))*1000)/1000;
    var cssClass = 'lost';
    if(win > window['maxwin_'+playing_with]) {
      win = 'Bet too high';
      hide = 1;
      if(won == 0) {
        cssClass = 'won';
      }
    } else if(won == 1) {
      cssClass = 'won';
      win = Math.round(win*1000 * (1-houseedge) - tmp*1000) / 1000+' '+asset;
    } else if(won == 0) {
      win = 0 - tmp;
      win = win+' '+asset;
    }
  } else {
    win = 'Invalid bet';
    hide = 1;
    cssClass = 'won';
  }

  $('.result'+block).addClass(cssClass).text(win);
  if(hide == 1) {
    doneblocks['"'+block+'"'] = 2;
    $('.result'+block).parent().hide();
  }
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

function bankrollModified(sign, amount) {
  var direction = 'positive';
  if(sign == '-') {
    direction = 'negative';
  }

  amount = Math.round(amount*1000)/1000;
  
  $("#bankroll_movement_container").html('<strong class="bankroll__movement bankroll__movement--'+direction+'">'+sign+amount+'</strong>');
  setTimeout(function(){
    $("#bankroll_movement_container").html("");
  },2100);
}



function fromWif(_private_wif) {        
    var private_wif = bs58decode(_private_wif);
    var private_key = private_wif.slice(0, -4);
    private_key = private_key.slice(1);
    var h = '';
    for (var i = 0; i < private_key.length; i++) {
        h += private_key[i].toString(16);
    }
    return h;
}

function bs58decode(string) {
  var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  var ALPHABET_MAP = {}
  var BASE = ALPHABET.length
  var LEADER = ALPHABET.charAt(0)

  // pre-compute lookup table
  for (var i = 0; i < ALPHABET.length; i++) {
      ALPHABET_MAP[ALPHABET.charAt(i)] = i
  }

    if (string.length === 0) return []

    var bytes = [0]
    for (var i = 0; i < string.length; i++) {
      var value = ALPHABET_MAP[string[i]]
      if (value === undefined) throw new Error('Non-base' + BASE + ' character')

      for (var j = 0, carry = value; j < bytes.length; ++j) {
        carry += bytes[j] * BASE
        bytes[j] = carry & 0xff
        carry >>= 8
      }

      while (carry > 0) {
        bytes.push(carry & 0xff)
        carry >>= 8
      }
    }

    // deal with leading zeros
    for (var k = 0; string[k] === LEADER && k < string.length - 1; ++k) {
      bytes.push(0)
    }

    return bytes.reverse()
}