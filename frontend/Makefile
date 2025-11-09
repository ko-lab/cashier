.PHONY: assets

SRC := src
DST := dest
CNA := kobar


static:
	cp $(SRC)/index.html $(DST)/
	find $(SRC)/js -type f -exec cp {} $(DST)/js \;
	find $(SRC)/css -type f -exec cp {} $(DST)/css \;
	cp -r ./api $(DST)
assets:
	 find  assets/img/ -type f -exec cp {} $(DST)/img \;


execnode:
	docker run -v .:/app --rm -it --entrypoint /bin/bash node

node:
	mkdir -p $(DST)/css
	mkdir -p $(DST)/img
	mkdir -p $(DST)/js
	docker run -v .:/app --rm -it --entrypoint /bin/sh node -c "cd /app && npm i"
	find node_modules/ -iname "bootstrap.min.css*" -exec cp {} $(DST)/css/ \;
	find node_modules/ -iname "bootstrap.bundle.min.js*" -exec cp {} $(DST)/js/ \;
	find node_modules/ -iname "vue.esm-browser.prod.js*" -exec cp {} $(DST)/js/ \;
	find node_modules/ -iname bootstrap-icons.svg -exec cp {} $(DST)/img/ \;
	find node_modules/ -iname qrcode.min.js -exec cp {} $(DST)/js/ \;

test:
	docker run -p 9001:80 -v ./$(DST):/usr/share/nginx/html --name $(CNA) --rm -it nginx
	
bg:
	docker run -p 9001:80 -v ./$(DST):/usr/share/nginx/html --name $(CNA) --rm -d nginx
stop:
	docker stop $(CNA)	
