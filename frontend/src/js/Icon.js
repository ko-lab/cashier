import { ref } from 'vue'

export default {
  props: ['bi','sz','color','addClass'],
  setup(props) {
	let c = "white"
	let addcl = " "
	if (props.color != undefined) {
		c = props.color
	}
	if (props.addClass != undefined) {
	  addcl += props.addclass
	}
	const color = ref(c)
	const icon = ref(props.bi);
        return {icon,color,addcl,props}
  },
  template: `
<svg style="cursor:pointer;" :class="'bi '+addcl" v-bind:width="props.sz" v-bind:height="props.sz" > 
  <rect rx="2" x="0" y="0" v-bind:width="props.sz" v-bind:height="props.sz" fill="000000" fill-opacity="0.01"></rect>
  <use :xlink:href="'./img/bootstrap-icons.svg#'+icon" v-bind:fill="color"/> 
</svg>
`
}

