import { createApp,ref,computed,nextTick } from 'vue'
import Icon from './Icon.js'

const app = createApp({ 
    methods: {
	    reset() {
		let upd = this
		upd.member = ""
		upd.filter = ""
                upd.transactionstage = 0
		upd.transaction = []
		upd.items = []
		this.fetchDataFromAPI()
		nextTick().then(() => {
			console.log("scrolling")
			window.scrollTo({ top: 0, behavior: 'smooth'});
		})
	    },
	    fetchDataFromAPI() {
		let upd = this

		upd.items = []
		let getItems = `${this.apiUrl}/menu.json`
		
		fetch(getItems, { 
  			method: 'GET'
		}).then(function(response) { return response.json(); })
		.then(function(json) {
			upd.items = json
		}); 	
	    },
	    fetchPayment() {
		let upd = this
		upd.transactionstage = 1

		let postPay = `${this.apiUrl}/menu.json`
		fetch(postPay, { 
  			method: 'GET'
		}).then(function(response) { return response.json(); })
		.then(function(json) {
			upd.transactionstage = 2
			let msg = "transactid"
			let accname = "klb"
			let accibn = "BE"
			let qrepc = [
				"BCD",
				"002",
				"1",
				"SCT",
				"",
				"${accname}",
				"${accibn}",
				`EUR${upd.transactiontable.total}`,
				"",
				"",
				msg.substr(0,100),
				"",
			]
			var qrcode = new QRCode({
			  content: qrepc.join("\n"),
			  padding: 4,
			  width: 256,
			  height: 256,
			  color: "#000000",
			  background: "#ffffff",
			  ecl: "H",
			});


			upd.qrcode = qrcode.svg();
			nextTick().then(() => {
				const scrollDiv = document.getElementById("pay");
				window.scrollTo({ top: scrollDiv.offsetTop, behavior: 'smooth'});
				setTimeout(() => {
					upd.transactionstage = 3
				},10000)	
				
			})
		})
	    },
	    confirmPayment() {
		this.reset();
	    },
	    handleKeyPress(event) {
		if (event.code.startsWith('Digit') || event.code.startsWith('Numpad')) {
			let num = event.code.replace("Digit","").replace("Numpad","")
			if (num.length == 1) {	
			 if(this.showmemberinput) { this.member += num }
			 else { this.filter += num }
			} else if (event.key == "Enter") {
			 if(this.showmemberinput) { this.showmemberinput = false; }
			} else if (event.key == "Min") {
			 if(this.showmemberinput) { this.member = ""; }
			} else if (event.key == "/") {
			 if(!this.showmemberinput) { this.showmemberinput = true; } 
			}
		} else if (event.code == "Backspace") {
			if(this.showmemberinput) { this.member = this.member.slice(0, -1);} 
			else { this.filter = this.filter.slice(0, -1); } 
		} else if (event.code == "Escape") {
			 if(this.showmemberinput) { this.member = ""; } 
			 else { this.filter = "" }
		} else if (event.key == "Enter") {
			 if(this.showmemberinput) { this.showmemberinput = false; }; 
		} else if (event.key == "d") {
			 if(!this.showmemberinput) { this.showmemberinput = true; }
		} else if (event.key == "Min") {
			 if(this.showmemberinput) { this.member = ""; }
		} else if (event.key == "t") {
			let t = document.getElementById("total")
			window.scrollTo(0,t.offsetTop)
		} else if (event.key == "p") {
			let t = document.getElementById("pay")
			window.scrollTo(0,t.offsetTop)
		}  else if (event.key == "s") {
			let t = document.getElementById("selection")
			window.scrollTo(0,t.offsetTop)
		}   else if (event.key == "x") {
			this.reset()
		} 

		event.preventDefault()
	    }
    },
    mounted() {
	this.fetchDataFromAPI();
	document.addEventListener('keydown', this.handleKeyPress)
    },
    setup() {
	const apiUrl = '/api'; 

	const member = ref("")
	const filter = ref("")
	const showmemberinput = ref(false)
	const iconsize = ref(48)
	const transaction = ref([])

	const transactionstage = ref(0)
	
	const items = ref([
		{"id":1,"name": "Coca-Cola","img":"./img/sq-cocacola.svg","ean":"3333334","price":{"member":"3","nonmember":"4"}},
		{"id":2,"name": "Club Mate","img":"./img/sq-club-mate.svg","ean":"3333335","price":{"member":"3","nonmember":"4"}},
	])
	const itemtable = computed(() => {
		let list = items.value.filter((item) => (filter.value == "")?true:item.ean.toString().includes(filter.value))
		if (filter.value.length > 2 && list.length == 1) {
			//if the filter has 3 or more char and the list is one item exactly, then we can select it
			//this enables barcode scanning to continiously import 
			filter.value  = ''
			transaction.value.push({'id':list[0].id,'amount':1});
			list = items.value
		}
		return list
	}) 
	const transactiontable = computed(() => {
		let tt = []
		const tas = transaction.value
		const itv = items.value
		let total=0
		for (let t in tas) {
			var tl = tas[t]
			var item = itv.find(item => item.id === tl.id); 
			let price = member.value>0?item.price.member:item.price.nonmember
			let linetotal = parseFloat(price)*tl.amount
			total +=linetotal
			tt.push({tlid:t,"item":item.name,"count":tl.amount,"price":price,"total":linetotal})
		}
		return {"total":total,"table":tt}
	})
	

	const qrcode = ref("")

	return {
		apiUrl,
		member,
		filter,
		iconsize,
		transaction,
		transactiontable,
		transactionstage,
		items,
		itemtable,
		qrcode,
		showmemberinput
	}

      }
})
app.component("icon",Icon)
app.mount('#body')


