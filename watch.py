from steemapi.steemclient import SteemClient
import sqlite3
import json
import time

#config
watching = 'steemdice1'
maxwin = {'STEEM': 10,'SBD': 5}
houseedge = 0.01

#set up libraries
class Config():
    wallet_host = "localhost"
    wallet_port = 8092
    witness_url = "ws://localhost:8090"
conn = sqlite3.connect('dice.db')
c = conn.cursor()
client = SteemClient(Config)

def main():

  c.execute("SELECT blockheight FROM last_check")
  blockheight = c.fetchall()
  startblock = blockheight[0][0]

  #watch account
  account = client.ws.get_accounts(['pharesim'])
  id = account[0]['id']
  props = client.ws.get_dynamic_global_properties()
  headblock = props['head_block_number']
  go = True
  getblock = startblock
  while go == True:
    block = client.ws.get_block(getblock)
    if block != None:
      for txs in block['transactions']:
        for (i,tx) in enumerate(txs['operations']):
          if tx[0] == 'transfer' and tx[1]['to'] == watching:
            amount = tx[1]['amount'][:-6]
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
              asset = tx[1]['amount'][-5:]
              if asset != 'STEEM':
                asset = tx[1]['amount'][-3:]

              if win > maxwin[asset]:
                client.wallet.transfer(watching,sender,tx[1]['amount'],'Sorry, the maximum amount you can win in one game is '+str(maxwin[asset])+' '+asset,True)
              else:
                try:
                  with conn:
                    c.execute('''INSERT OR IGNORE INTO percentagebets (block, txid, user, amount, bet, asset) VALUES (?,?,?,?,?,?)''', (getblock, i, sender, amount, memo, 'STEEM'))
                except:
                  print('ERROR INSERTING BET')
            elif memo != 'funding':
                client.wallet.transfer(watching,sender,tx[1]['amount'],'Your bet was invalid',True)

      getblock = getblock + 1
    else:
      go = False

  try:
    with conn:
      c.execute('''UPDATE last_check SET blockheight=?''', (getblock,))
  except:
    print('ERROR UPDATING BLOCKHEIGHT')

  #get active bets
  c.execute("SELECT block, txid, user, amount, bet, asset FROM percentagebets WHERE processed IS NOT 1")
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
        res = client.ws.get_block(checkblock)
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
          client.wallet.transfer(watching,user,won+" "+asset,'Congratulations, you won! Your bet: '+details['type']+' '+str(details['number'])+'; Result: '+str(result),True)
          processed = True
        except:
          print('ERROR SENDING MONEY')
      elif won == 0 and amount > 0.003:
        client.wallet.transfer(watching,user,'0.001 '+asset,'You lost! Your bet: '+details['type']+' '+str(details['number'])+'; Result: '+str(result),True)

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


if __name__ == "__main__":
  while True:
    print('checking...')
    main()
    time.sleep(1)

conn.close()
