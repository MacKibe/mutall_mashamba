//
//Get pre existing methods usefull for creating elements and other functionality
import { view } from '../../../outlook/v/code/view.js';
//
//For Reporting errors within the program flow
import { mutall_error } from "../../../schema/v/code/schema.js";
//
//This is type a guard for testing whether some user input is a group or not
export function is_group(user_input) {
    //
    //Any input is a group if it contains a key named 'type' whose type is  
    //string
    return ('type' in user_input && typeof user_input['type'] === 'string');
}
//
//Dialog is an abstract class that has 3 public methods:-
//-administer - the collecteds inputs from user
//- populate that filles a dialog box with inputs
//- get_raw_user_inputs that reads the user modified inputs
export class dialog extends view {
    fragment;
    data_original;
    modal;
    //
    //Visual representation of the dialog class
    visual;
    //
    //
    constructor(
    //
    //The optional html fragment needed for cnstrucipng a dialogbox compirise
    //of 2 parts: the url and the pont where to anchor it. It is not 
    //needed when the input form is already designed by the user. 
    //The mashamba project is a case in point 
    fragment, 
    //
    //The original data being edited
    data_original, 
    //
    //How to show the dialog, modal or modalless
    modal = true) {
        //
        //Get the url (for the parent constructor) of the html fragment is 
        //given
        super(fragment ? fragment.url : undefined);
        this.fragment = fragment;
        this.data_original = data_original;
        this.modal = modal;
        //
        //Create a dialog box on the given fragment anchor. If teh fragment is not
        //given, we shall use the existing body
        const anchor = fragment ? fragment.anchor : this.document.body;
        //
        //Create teh visual aspect of the dialog box
        this.visual = this.create_element("dialog", anchor);
    }
    async administer() {
        //
        //Show the dialog (there may be a need to fetch a url from the server)
        const { submit, cancel } = await this.open();
        //
        //Wait for the user to click either save or cancel button and when they 
        //do return the imagery or undefined(JM,SW,JK,GK,GM)
        const result = await this.get_user_response(submit, cancel);
        //
        //Close the dialog unconditional
        this.close();
        //
        return result;
    }
    //
    //Process of attaching the form fragment to the dialog box and populating the 
    //form in case of data modification.After all these processes show the dailog
    //box to the user for data entry.
    async open() {
        //
        //If the html fragment is provided, use it to show the dialog box 
        if (this.fragment) {
            //
            //Request for the content of the file specified by the path 
            const response = await fetch(this.fragment.url);
            //
            //Check whether there was an error in server-client communication 
            if (!response.ok)
                throw new mutall_error(`Fetching ${this.url} failled. Status code${response.status}, 
                    status text ${response.statusText}`);
            //
            //Append the string to the html of the dialog
            this.visual.innerHTML = await response.text();
            //
            //Get whatever form was appended to the dialog
            const form = this.visual.querySelector("form");
            //
            //Prevent the default submit behaviour of the form if present
            if (form)
                form.onsubmit = (e) => e.preventDefault();
        }
        //
        //If there is any data avalable use it to populate this page
        if (this.data_original)
            this.populate(this.data_original);
        //
        //Show the dialog box, depending on desired mode
        if (this.modal)
            this.visual.showModal();
        else
            this.visual.show();
        //
        //Return the submit and cancel buttons.
        return { submit: this.get_element('submit'), cancel: this.get_element('cancel') };
    }
    //
    //We wait for the user to enter the data that is required in the form and initate
    //one of two processes:-
    //1. submit
    //2. Cancel
    //Based on the user selected process we prefom relevant actions
    get_user_response(submit, cancel) {
        //
        //Wait for the user to enter data and initiate the desired process
        return new Promise((resolve) => {
            //. After entering input details the user can either
            //
            // ...submit the data
            submit.onclick = async () => await this.submit(resolve);
            //
            // ... terminate the process by canceling
            cancel.onclick = () => resolve(undefined);
        });
    }
    //
    //This closes the dialog when all operations concerning it are done
    close() {
        //
        //Detach the dialog from the anchor
        //
        //This step is necessary only if the dialogbox was desigend using a
        //html fragment
        if (this.fragment)
            this.fragment.anchor.removeChild(this.visual);
    }
    //
    //Here we collect the data that the user enterd in the form then save considering 
    //the different sources of the data while reporting any errors to the user
    //and eventually resolving the promised data upon succesful saving.
    async submit(resolve) {
        //
        //Retrieve the infromation that was enterd by the user(JM)
        const input = await this.read();
        //
        //Check the raw data for errors, reporting them if any(JM) 
        const output = this.check(input);
        //
        //Continue only of there were no errors. Note the explicit use of '====', 
        //just incase output was a boolean value
        if (output === undefined)
            return;
        //
        //Save the content (GK,SW,JK,GM)
        const result = await this.save(output);
        //
        //Resolve the promised Idata if the operation was succesful
        if (result === "ok")
            resolve(output);
        //
        ///..otherwise report the error in a general fashion, i.e., not targeting
        //a specific user input
        else
            this.report_error("report", result.message);
    }
    //Check the raw data for errors, returning with the clean data if there are
    //no errors and void if there are.
    check(input) {
        //
        //Let output be the desired result.
        const output = 
        //
        //If the input is a group, return the group check result
        is_group(input) ? this.check_group(input)
            //
            //If the inpt is not a gepup and us errornous, return the void of the
            //the error report
            : input instanceof Error ? this.report_error('report', input.message)
                //
                //If the input is not an error then return it as the output, casted
                //into clean data
                : input;
        //
        return output;
    }
    //Check the raw group (of user inputs) for errors
    check_group(input) {
        //
        //The input must be a group.If it is not, throw an exception
        if (!is_group(input))
            throw new mutall_error('User input group expected');
        //
        //Isolate the all the raw data keys. Ojcet keys are always strings.
        //Coerce them to the correct type (so that the next filtering can use
        //the correct data types)
        const keys = Object.keys(input);
        //
        //Filter out the erroneous keys of the raw data
        const err_keys = keys.filter(key => input[key] instanceof Error);
        //
        //If errors are found, report them to the user and discontinue this 
        //submisssion
        if (err_keys.length > 0) {
            //
            //Report the errors
            err_keys.forEach(key => {
                //
                //use the given (string) key as a (keyof Idata) get the raw data
                //must be an error 
                const error = input[key];
                //
                //Report the error message. Assue the key must be a string
                this.report_error(key, error.message);
            });
            //
            return undefined;
        }
        //
        //Reteurn input as the clean data
        return input;
    }
}
