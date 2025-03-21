import asyncHandler from "../middleware/asyncHandler.js";
import Admin from "../models/Admin.js";
import Employee from "../models/Employees.js";
import { generateToken } from "../utils/generateToken.js";
import employeeValidationSchema from "../validation/validation.employe.js"

// @desc Register Employee
// @route POST /api/employees
//@access Private
export const register = asyncHandler(async (req, res) => {

    // validation

    const {error} = employeeValidationSchema.validate(req.body, { abortEarly: false });

        if (error) {
            // Extract validation error messages
            const errorMessages = error.details.map(detail => detail.message);
            return res.status(400).json({ errors: errorMessages });
        }


    // if (req.activeRole && req.activeRole === "admin") {
    const {
        fName,
        lName,
        email,
        password,
        confPassword,
        gender,
        mobile,
        empRole,
        empId,
    } = req.body;
    const existingUser = await Employee.findOne({ email });

    if (existingUser) {
        res.status(400);
        throw new Error("Employee already exists!!!");
    }

    if (password !== confPassword) {
        res.status(400);
        throw new Error("Passwords do not match");
    }

    // const empId = generateEmpId();
    const employee = await Employee.create({
        fName,
        lName: lName ? lName : "",
        email,
        password,
        gender,
        mobile,
        empRole,
        empId,
    });
    if (employee) {
        generateToken(res, employee._id);
        return res.status(201).json({
            _id: employee._id,
            name: employee.fName + " " + employee.lName,
            email: employee.email,
            empRole: employee.empRole,
        });
    }
    // } else {
    //     // If user is not an admin, deny access
    //     res.status(403);
    //     throw new Error("Not authorized to register employees");
    // }
});

// @desc Auth user & get token
// @route POST /api/employees/login
// @access Public
export const login = asyncHandler(async (req, res) => {
    let { email, password } = req.body;

    email = email.trim();
    password = password.trim();

    // Find the user by email
    const employee = await Employee.findOne({ email: email });

    console.log('employee',employee)

    if (!employee.isActive) {
        res.status(401);
        throw new Error("Your account has been deactivated!!");
    }
    if (employee && (await employee.matchPassword(password))) {
         let token = generateToken(res, employee._id);

        res.status(200).json({
            _id: employee._id,
            name: employee.fName + " " + employee.lName,
            email: employee.email,
            empRole: employee.empRole,
            token,
        });
    } else {
        res.status(401);
        throw new Error("Invalid email or password");
    }
});

// @desc Logout Employee / clear cookie
// @route POST /api/employees/logout
// @access Private
export const logout = (req, res) => {
    res.cookie("jwt", "", {
        httpOnly: true,
        expires: new Date(0),
    });
    res.status(200).json({ message: "Logged out successfully" });
};

// @desc Get all employees
// @route GET /api/employees/
// @access Private
export const getAllEmployees = asyncHandler(async (req, res) => {
    if (req.activeRole === "admin") {
        const employees = await Employee.find({});
        return res.json(employees);
    }
});

// @desc Get a particular employee
// @route GET /api/employees/:id
// @access Private
export const getAnEmployee = asyncHandler(async (req, res) => {
    let employeeId;

    if (req.params.id === "me") {
        employeeId = req.employee._id.toString();
    } else {
        employeeId = req.params.id;
    }

    const employee = await Employee.findOne({ _id: employeeId }).select(
        "-password"
    );

    if (employee) {
        return res.json(employee);
    }
    res.stauts(400);
    throw new Error("Employee not found!!");
});

// @desc Add Admin Bank accounts
// @route POST /api/employees/admin/banks
// @access Admin
export const addAdminBanks = asyncHandler(async (req, res) => {
    if (req.activeRole === "admin") {
        // Check if there's an exisiting Admin document
        let admin = await Admin.findOne();

        const { bankName, branchName, accountNumber, accountHolder, ifsc } =
            req.body;

        const newBank = {
            bankName,
            bankBranch: branchName,
            accountNo: accountNumber,
            accountHolder,
            ifscCode: ifsc,
        };

        if (admin) {
            // Admin document exists; update the bank array by appending the new bank
            admin.bank.push(newBank);
            await admin.save();
            return res.json({
                success: true,
                message: "Bank has been saved!!",
            });
        } else {
            // No Admin document exists; create a new one
            admin = new Admin({ bank: [newBank] });
            await admin.save();
            return res.json({
                success: true,
                message: "Bank has been saved!!",
            });
        }
    }
});

// @desc Get Admin Bank accounts
// @route GET /api/employees/admin/banks
// @access Private
export const adminBanks = asyncHandler(async (req, res) => {
    const banks = await Admin.find({});
    return res.json(banks);
});
