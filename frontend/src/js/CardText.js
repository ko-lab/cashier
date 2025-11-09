import { ref } from 'vue'



export default {
  setup() {
	const count = ref(1);
        return {count}
  },
  template: `
<text x="16" y="20" text-anchor="middle">{{count}}</text>
`
}

