export namespace main {
	
	export class CheatConfig {
	    aimbotEnabled: boolean;
	    aimbotFOV: number;
	    aimbotSmoothness: number;
	    rcsEnabled: boolean;
	    wallhackEnabled: boolean;
	    espEnabled: boolean;
	    triggerbotEnabled: boolean;
	    triggerbotDelay: number;
	    bunnyhopEnabled: boolean;
	    radarHackEnabled: boolean;
	    skinChangerEnabled: boolean;
	    knifeType: number;
	    gloveType: number;
	    skinWear: number;
	
	    static createFrom(source: any = {}) {
	        return new CheatConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.aimbotEnabled = source["aimbotEnabled"];
	        this.aimbotFOV = source["aimbotFOV"];
	        this.aimbotSmoothness = source["aimbotSmoothness"];
	        this.rcsEnabled = source["rcsEnabled"];
	        this.wallhackEnabled = source["wallhackEnabled"];
	        this.espEnabled = source["espEnabled"];
	        this.triggerbotEnabled = source["triggerbotEnabled"];
	        this.triggerbotDelay = source["triggerbotDelay"];
	        this.bunnyhopEnabled = source["bunnyhopEnabled"];
	        this.radarHackEnabled = source["radarHackEnabled"];
	        this.skinChangerEnabled = source["skinChangerEnabled"];
	        this.knifeType = source["knifeType"];
	        this.gloveType = source["gloveType"];
	        this.skinWear = source["skinWear"];
	    }
	}

}

