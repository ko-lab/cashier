# POS
This document describes the POS/CASHIER SYSYTEM of KO-LAB Hacker/Makerspace.

## Current situtaion and problems with it
Currently, we have fridge, and on the fridge, there is a Payconiq QR code. This allows people to pay for the stuff they take.
The shortcomings of this are:
- we we need to do manual inventory counting
 - we have no idea how much of which item was used on which day
- people need to do calculation of how much they need to pay
- if people don't pay, we have no way of easily knowing who or when it was
- people can easily accidentally pay the wrong amount
- members always need a smartphone to pay, would be nicer if they could make a deposit once and then just use from that deposit. That way, it's a bit less of a hassle for members to take consumptions

## Goal / Raison D'etre

So in order to improve on the situation above, we want to have some POS or cashier system. As you can see from the explanation above there is a few things that we want from this system:
### First milestone: help users with calc, make QR, log data
- so in the first milestone, there is no deposits, so accounts are not that important yet.
- So in this first milestone, the idea is that we have a website - which will be loaded on a PC next to the fridge - which will allow to 'Make a transation'.
 - This transaction just means a list of products that was bought and paid for.
 - The system just helps with transation by giving a QR code and a total amount to be paid, but it does not check anything, it trusts the user to pay when the QR code is shown.
   - Problem here is that people can change their mind, or maybe they accidentally clicked
   - So the QR screen should have some very good UX that allows users to inform that they have paid or that they want to cancel.
      - Note that we want to save those cancelled transactions somewhere as well
- for this, there needs to be backend that allows saving the transactions.
  - These transactions should have a list of items and the price paid.
- for this first milestone, the transactions should be saved somewhere accessible for developers
- for this first milestone, the developers will need to hardcode the items and inventory counts
- this will not be that useful yet, but it will allow testing the UX and serving as a starting point
- one important thing though is that members have different prices and if we want to be able to just turn the PC on and let random people as well as members use it, then this needs to be supported.
  - This means that there should be a "Member Prices" toggle on the website that would switch between member and non-member prices and the backend also needs to support this.
- In the backend, there should be product catalog editable by the devs, so that means just a JSON somewhere.


### Second milestone
- Transaction statistics should be visible somewhere for admins: these transactions would be pretty useless and also it would be hard to see if it is working if we don't do anything with it.
- So this means that we should have a parallel "admin system"
  - this admin system should allow: 
    - adding an item to the product list
    - updating the inventory
    - counting the amount of items used
    - deactivating/activating a product, for example for in case it's permanently out of stock
    - seeing the list of completed  transactions
    - seeing the list of cancelled transactionsO

### Post MVP
- After the MVP, we want to improve the system in the following ways:
  - we want to these transactions to be verifyable so that they can be used for official accounting
   - This means that either the POS systems needs to be able to get info from the bank account/ payments system, or some UI system needs to be made where admins can "verify a transaction" after they manually check the bank account.
- This meanse that the backend should support this verififcation, it should allow setting when it was done at least

### Nice to haves
- grouping products: add a group/category/tag system so that products that can be used by the users for filtering and by the admins for statistics
- would be nice if we can see who or what did the verification of a tranaction:
 - this means that the admin system should have a user selection so that we can log who did a verification

## Practical setup
There will be a PC right next to the fridge that will automatically open the POS website on startup and that will be turned on when there are people in the space.
### Infra and security
- 

