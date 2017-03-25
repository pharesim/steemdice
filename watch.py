from piston import Steem
from piston.block import Block
from pistonbase import transactions
from pistonapi.steemnoderpc import SteemNodeRPC
import sqlite3
import json
import time
import sys
from pprint import pprint

#config
watching = 'steemdice1'
maxwin = {'STEEM': 100,'SBD': 25}
houseedge = 0.02

wif = ''
client = Steem()
#rpc = SteemNodeRPC('ws://steemd.pharesim.me:8090')
rpc = SteemNodeRPC('wss://steemd.steemit.com')

conn = sqlite3.connect('dice.db')
c = conn.cursor()

def main():
  c.execute("SELECT blockheight FROM last_check")
  blockheight = c.fetchall()
  startblock = blockheight[0][0]

  #watch account
  go = True
  getblock = startblock
  while go == True:
    print('Block: '+str(getblock))
    try: 
      block = Block(getblock)
    except:
      block = None

    if block != None:
      for txs in block['transactions']:
        for (i,tx) in enumerate(txs['operations']):
          if tx[0] == 'transfer' and tx[1]['to'] == watching:
            asset = getAssetFromAmount(tx[1]['amount'])
            if asset == 'STEEM':
              amount = tx[1]['amount'][:-6]
            else:
              amount = tx[1]['amount'][:-4]
            memo = tx[1]['memo']
            sender = tx[1]['from']
            factor = 0
            try:
              details = json.loads(memo)
              if 'type' in details:
                if details['type'] == 'higher':
                  factor = 100-details['number']
                elif details['type'] == 'lower':
                  factor = 0+details['number']
            except:
              factor = 0

            if factor > 0:
              win = float(amount) * 100/factor
              if win > maxwin[asset]:
                transfer(watching,sender,tx[1]['amount'],'Sorry, the maximum amount you can win in one game is '+str(maxwin[asset])+' '+asset)
              else:
                try:
                  with conn:
                    c.execute('''INSERT OR IGNORE INTO percentagebets (block, txid, user, amount, bet, asset) VALUES (?,?,?,?,?,?)''', (getblock, i, sender, amount, memo, asset))
                except:
                  print('ERROR INSERTING BET')
            elif memo != 'funding':
                transfer(watching,sender,tx[1]['amount'],'Your bet was invalid')

      getblock = getblock + 1
    else:
      go = False

  try:
    with conn:
      c.execute('''UPDATE last_check SET blockheight=?''', (getblock,))
  except:
    print('ERROR UPDATING BLOCKHEIGHT')

  #get active bets
  c.execute("SELECT block, txid, user, amount, bet, asset FROM percentagebets WHERE processed IS NOT 1 AND won IS NOT 0")
  bets = c.fetchall()
  for bet in bets:
    block = bet[0]
    txid = bet[1]
    user = bet[2]
    amount = bet[3]
    try:
      details = json.loads(bet[4])
    except:
      details = {}
    asset = bet[5]
    result = 1000000
    checkblock = block
    while result > 999999:
      checkblock = checkblock + 1
      try:
        res = Block(checkblock)
        if res != None:
          result = int(res['previous'][-5:],16)
        else:
          result = -1
      except:
        result = result + 1

    won = 0
    factor = 0
    if result > -1:
      result = result%(10000)/100
      processed = True
      if 'type' in details:
        if details['type'] == 'higher':
          factor = 100-details['number']
          if result > details['number']:
            won = 1
        elif details['type'] == 'lower':
          factor = 0+details['number']
          if result < details['number']:
            won = 1

      if won == 1 and factor > 0:
        processed = False
        factor = 100/factor
        won = (amount * factor) * (1 - houseedge)
        won = str(won).split('.')
        if len(won[1]) > 3:
          won[1] = won[1][0:3]
        while len(won[1]) < 3:
          won[1] = won[1]+'0'
        won = won[0]+'.'+won[1]
        try:
          transfer(watching,user,won+" "+asset,'Congratulations, you won! Your bet: '+details['type']+' '+str(details['number'])+'; Result: '+str(result))
          processed = True
        except:
          print('ERROR SENDING MONEY')
      elif won == 0 and amount > 0.003:
        transfer(watching,user,'0.001 '+asset,'You lost! Your bet: '+details['type']+' '+str(details['number'])+'; Result: '+str(result))

      unsaved = 1
      while unsaved == 1:
        try:
          with conn:
            c.execute("UPDATE percentagebets SET result=?, won=?, processed=? WHERE block=? AND txid=?",(result,float(won),processed,block,txid))
            unsaved = 0
        except:
          print('ERROR SAVING TO DATABASE!')

  conn.commit()
  return True

def transfer(sender,recipient,amount,memo):
  expiration = transactions.formatTimeFromNow(60)
  op = transactions.Transfer(
    **{"from": sender,
       "to": recipient,
       "amount": amount,
       "memo": memo}
  )
  ops    = [transactions.Operation(op)]
  ref_block_num, ref_block_prefix = transactions.getBlockParams(rpc)
  tx     = transactions.Signed_Transaction(ref_block_num=ref_block_num,
                                         ref_block_prefix=ref_block_prefix,
                                         expiration=expiration,
                                         operations=ops)
  tx = tx.sign([wif])

  # Broadcast JSON to network
  rpc.broadcast_transaction(tx.json(), api="network_broadcast")


def getAssetFromAmount(amount):
  asset = amount[-5:]
  if asset != 'STEEM':
    asset = amount[-3:]
  return asset

if __name__ == "__main__":
  while True:
    print('checking...')
    main()
    time.sleep(1)

conn.close()
