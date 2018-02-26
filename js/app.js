// config
var bank = 'steemdice1';
var houseedge = 0.02;
var maxwin_steem = 100;
var maxwin_sbd = 25;

var steemws = 'wss://steemd.pevo.science';

// display
var updateInterval = 3000;
var playing_with = 'steem';

// global variables
var blocks = [];
var doneblocks = {};
var updating = false;
var bankroll_sbd = 0;
var bankroll_steem = 0;
var loggedIn = false;
var user = '';
var pub = '';
var wif = '';

// main function
$( document ).ready(function() {

  steem.config.set('websocket',steemws);
  steem.setMaxListeners(0);
  // fill in variables
  $("#houseEdge").text(houseedge * 100);
  $("#max_win_steem").text(maxwin_steem);
  $("#max_win_sbd").text(maxwin_sbd);

  // currency selection and switching
  $(".play_with_sbd, .play_with_steem, #bankroll").hide();
  $(".play_with_"+playing_with).show()
  $("#switch_to_sbd, #switch_to_steem").click(function(e){
    e.preventDefault();
    $(".play_with_sbd, .play_with_steem").toggle();
    if(playing_with == 'sbd') {
      playing_with = 'steem';
    } else {
      playing_with = 'sbd';
    }
  });

  // double bet button
  $('#double_bet').click(function(e){
    e.preventDefault();
    if(loggedIn == false) {
      $("#login_modal").addClass('is-toggled');
    } else {
      let oldbet = $('#bet_amount').val();
      $("#bet_amount").val(oldbet*2);
      $("#bet_amount").change();
      calculateWin();
    }
  });

  // Mousewheel Support for Bet Amount
  $("#bet_amount").mousewheel(function(turn, delta) {
    let oldbet = $('#bet_amount').val();

    // Mousewheel up
    if (delta == 1) {
      $("#bet_amount").val(oldbet*2);

    // Mousewheel down
    } else {
      $("#bet_amount").val(oldbet/2);
    }

    $("#bet_amount").change();

    calculateWin();
  });

  // check bet amount
  $("#bet_amount").change(function(e){
    let betAmount = $(this).val();

    // minimum bet 100 of the smallest unit to ensure fees
    if(betAmount < 0.1) {
      betAmount = 0.1;
    }

    // check against bankroll of logged in users
    if(loggedIn == true) {
      let bankroll = window['bankroll_' + playing_with];
      let diff = bankroll - betAmount;
      if(diff < 0) {
        betAmount = bankroll;
      }
    }

    // enforce decimal point and limit to 3 decimals
    betAmount = String(betAmount).replace(',','.');
    let check = betAmount.split('.');
    betAmount = check[0];
    if(betAmount == '') { betAmount = 0; }
    if(check[1] !== undefined) {
      if(check[1].length > 3) {
        check[1] = check[1].substring(0,3);
      }
      betAmount = betAmount+"."+check[1];
    }

    $(this).val(betAmount);

    calculateWin();
  });

  // check chance
  $("#bet_chance").change(function(e){
    let betChance = $(this).val();

    //enforce decimal point
    betChance = betChance.replace(',','.');

    // between 0.01 and 99.99
    if(betChance > 99.99) {
      betChance = 99.99;
    }
    if(betChance < 0.01) {
      betChance = 0.01
    }

    $(this).val(betChance);

    calculateWin();
  });

  // mousewheel support for bet chance
  $("#bet_chance").mousewheel(function(turn, delta) {
    let betChance = $(this).val();

    betChance = betChance.replace(',','.');

    // Mousewheel up
    if (delta == 1) {
      betChance++;

    // Mousewheel down
    } else {
      betChance--;
    }

    if(betChance > 99.99) {
      betChance = 99.99;
    }
    if(betChance < 0.01) {
      betChance = 0.01
    }

    $(this).val(betChance);

    calculateWin();
  });


  // login and logout button/link
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

  // roll the dice
  
  
  $("#roll").click(function(){
    if(loggedIn == false) {
      $("#login_modal").addClass('is-toggled');
    } else {

      $("#roll").hide();
      $("#rolling").show();

      let amount = $("#bet_amount").val();
      amount = toThreeDecimals(amount);
      if(playing_with == 'sbd') {
        amount = amount+' SBD';
      }
      if(playing_with == 'steem') {
        amount = amount+' STEEM';
      }

      chance = $("#bet_chance").val();
      steem.broadcast.transfer(wif, user, bank, amount, '{"ui":"steemdice.net","type":"lower","number":'+chance+'}', function(err, result) {

        $("#rolling").hide();
        if(err !== null) {
          $("#roll_error").show();
          alert(err);
        } else {
          $("#rolled").show();
        }

        updateUser();

        setTimeout(
          function(){
            $("#rolled").hide();
            $("#roll_error").hide();
            $("#roll").show();
          },
          4000
        );
      });
    }
  });

  proceed();
});


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
  if(updating == false) {
    updating = true;
    steem.api.getDynamicGlobalProperties(function(err, result) {
      newProperties(result);
    });
    steem.api.getState('/@'+bank+'/transfers', function(err, result) {
      newBankState(result);
    });

    updateUser();
  }
}


// update footer
var newProperties = function(data) {
  var block = data['head_block_number'];
  var hash = data['head_block_id'];
  $('#lastBlockHeight').html(block);
  $('#lastBlockId').html(hash);
  var goal = calculateGoal(hash,block);
  if(goal == false) {
    goal = 'Ignored';
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
    if(tx[1]['op'][0] == 'transfer' && tx[1]['op'][1]['from'] != bank && tx[1]['op'][1]['from'] != 'minnowbooster' && tx[1]['block'] < $('#lastBlockHeight').text()) {
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
          } else {
            type = 'INV';
          }

          let number = escapeHtml(memo['number']);
          table.prepend(
            '<tr id="bet'+tx[1]['block']+tx[1]['trx_in_block']+'" class="block'+tx[1]['block']+'"><td>'+tx[1]['op'][1]['from']+
            '</td><td data-timestamp="'+Date.parse(tx[1]['timestamp']+'Z')+'" title="'+timesince(Date.parse(tx[1]['timestamp']+'Z'))+' ago">'+tx[1]['block']+
            '</td><td class="target'+tx[1]['block']+'"></td><td><span class="betType">'+type+'</span> <span class="betNumber">'+number+
            '</span><span class="betAmount" style="display:none">'+tx[1]['op'][1]['amount']+'</span></td><td class="profit'+
            tx[1]['block']+'"></td></tr>'
          );
        }
      }
      getBlock(tx[1]['block']);
    }
  }

  updating = false;
}


var calculateWin = function() {
  let amount = $("#bet_amount").val();
  let chance = $("#bet_chance").val();
  let factor = 100/chance;
  let win = (amount * factor) * (1 - houseedge);
  let maxwin = window['maxwin_'+playing_with];
  if(win > maxwin) {
      if(amount >= maxwin) {
        amount = maxwin / 2;
      }
      factor = (maxwin/(1-houseedge))/amount;
      chance = 100/factor;
      amount = Math.round(amount*1000)/1000;
      chance = Math.round(chance*100)/100;
      factor = 100/chance;
      $("#bet_amount").val(amount);
      $("#bet_chance").val(chance);
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
  $("#login_link, #signup_link, #logged_in_message, #bankroll").toggle();
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
    $('.profit'+block).each(function() {
      var elem = $(this).parent().children().eq(1);
      var value = elem.data('timestamp');
      elem.attr('title',timesince(value)+' ago');
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
    $(".target"+block).addClass('target'+next);
    $(".block"+block).addClass('block'+next);
    $(".profit"+block).addClass('profit'+next);
    doneblocks['"'+block+'"'] = 2;
    getBlock(next);
    return false;
  }
  $('.target'+block).text(goal).attr('title','Hash: '+hash);
  $(".block"+block).each(function(index){
    var type = $(this).find(".betType").html();
    var number = $(this).find(".betNumber").html();
    var amount = $(this).find(".betAmount").html();

    var won = 0;
    var factor = 100;
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

    var hide = 1;
    var cssClass = 'lost';
    var win = 'Invalid bet';
    if(factor > 0 && factor < 100) {
      var asset = amount.substring(amount.length-5,amount.length);
      if(asset.substring(1,2) == ' ') {
        asset = asset.substring(2);
      }
      var tmp = amount.substring(0,amount.length-6);
      var win = Math.round((tmp * 100000 / (factor*1000)) * (1-houseedge) *1000)/1000;
      if(win > window['maxwin_'+playing_with]) {
        win = 'Bet too high';
        if(won == 1) {
          cssClass = 'won';
        }
      } else if(won == 1) {
        cssClass = 'won';
        win = Math.round(win*1000 - tmp*1000) / 1000+' '+asset;
        hide = 0;
      } else if(won == 0) {
        win = 0 - tmp;
        win = win+' '+asset;
        hide = 0;
      }
    }

    $(this).find('.profit'+block).addClass(cssClass).text(win);
    if(hide == 1) {
      doneblocks['"'+block+'"'] = 2;
      $this().hide();
    }
  });
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
  var now = Date.now();
  var seconds = Math.floor((now - date) / 1000);
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

function toThreeDecimals(amount) {
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

  return amount;
}
