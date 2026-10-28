/**
 * CLIENT MACHINE — prints this computer's hardware id.
 *
 *   npm run license:hwid
 *
 * During setup, run this on the client's PC and send the printed id to the
 * supplier, who issues a licence bound to it. (The installer can also capture
 * this automatically.)
 */
import { getHardwareId } from '../license/hardware';

console.log(getHardwareId());
