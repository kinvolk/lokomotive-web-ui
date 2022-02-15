import smallScreenLogo from '../resources/small.svg';
import largeScreenLogo from '../resources/large.svg';
const { SvgIcon } = window.pluginLib.MuiCore;

class Branding  {
    
    initialize(register) {
        register.registerAppLogoChange((props: {logoType: string, theme: string}) => {
            const {logoType, ...other} = props;
            if(logoType === 'SMALL') {
                return <SvgIcon component={smallScreenLogo} viewBox="0 0 auto 32" {...other}/>
            } else {
                return <SvgIcon component={largeScreenLogo} viewBox="0 0 auto 32" {...other}/>
            }
        });
    
        return true;
      }
}

window.registerPlugin('branding-change', new Branding());