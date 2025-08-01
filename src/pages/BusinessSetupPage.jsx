import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  InputAdornment,
  Container,
  IconButton,
  CircularProgress,
  Snackbar
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import api from '../services/api';
import countries from '../utils/countries';
import countryStates from '../utils/countryStates';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

// Main validation schema
const validationSchema = Yup.object().shape({
  businessName: Yup.string().required('Business name is required'),
  website: Yup.string().url('Invalid URL format'),
  // Office address validation
  primaryEmail: Yup.string().email('Invalid email').required('Email is required'),
  phone: Yup.string()
    .matches(/^[0-9]{10}$/, 'Phone must be 10 digits')
    .required('Phone is required'),
  addressLine: Yup.string().required('Address is required'),
  city: Yup.string().required('City is required'),
  state: Yup.string().when('country', {
    is: (country) => country && countryStates[country] && countryStates[country].hasStates,
    then: () => Yup.string().required('State is required'),
    otherwise: () => Yup.string().notRequired(),
  }),
  pincode: Yup.string(), // Optional field
  country: Yup.string().required('Country is required'),
});

const BusinessSetupPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [countryCode, setCountryCode] = useState('in');
  const [selectedCountry, setSelectedCountry] = useState('India');
  const [geoLocationLoading, setGeoLocationLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState(null);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState(null);
  const [pincodeSuccess, setPincodeSuccess] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Check if user already has business details and redirect to dashboard if they do
  useEffect(() => {
    const hasBusinessDetails = user?.businesses && user.businesses.length > 0;
    
    if (hasBusinessDetails) {
      console.log('User already has business details. Redirecting to dashboard...');
      navigate('/dashboard');
    }
  }, [user, navigate]);
  
  const formik = useFormik({
    initialValues: {
      businessName: '',
      website: '',
      gstin: '',
      pan: '',
      primaryEmail: '',
      phone: '',
      addressLine: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India'
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError(null);

        // Format the payload to match the BusinessDetailsRequest structure
        // Create the office address object first
        const officeAddress = {
          email: values.primaryEmail,
          phone: values.phone,
          addressLine: values.addressLine,
          city: values.city,
          pincode: values.pincode,
          country: values.country
        };
        
        // Only include state field if the country has states
        if (values.country && countryStates[values.country] && countryStates[values.country].hasStates) {
          officeAddress.state = values.state;
        }
        
        const payload = {
          businessId: '',  // This will be generated by the backend
          businessName: values.businessName,
          gstin: values.gstin,
          pan: values.pan,
          email: values.primaryEmail,
          phone: values.phone,
          officeAddress: officeAddress
        };
        
        // Log the payload to verify state is only included for countries with states
        console.log('Country:', values.country);
        console.log('Country has states:', values.country && countryStates[values.country] && countryStates[values.country].hasStates);
        console.log('Payload:', payload);

        // Make API call with the API service
        const response = await api.post('/api/business/add', payload);
        
        // Store business details in localStorage for use in Dashboard
        if (response && response.businessId) {
          // Save the business details to localStorage
          localStorage.setItem('businessDetails', JSON.stringify(response));
          
          // Show success message briefly before redirecting
          setError(null); // Clear any existing error
          setSuccessMessage('Business setup successful! Redirecting to dashboard...');
          
          // Navigate to the dashboard page after a short delay
          setTimeout(() => {
            navigate('/dashboard');
          }, 1500);
        } else {
          throw new Error('No business ID returned from API');
        }
      } catch (error) {
        console.error('Error creating business:', error);
        
        // Only set error if it's an API response error, not a client-side error
        if (error.response) {
          // Server responded with an error status
          setError(error.response.data?.message || 'Error from server');
        } else if (error.request) {
          // Request was made but no response received
          setError('No response from server. Please check your connection.');
        } else {
          // Something else happened in setting up the request
          setError(error.message || 'Error creating business');
        }
      } finally {
        setLoading(false);
      }
    },
  });
  
  // Fetch user's location and set country defaults after formik is initialized
  useEffect(() => {
    const fetchLocationData = async () => {
      try {
        setGeoLocationLoading(true);
        const response = await axios.get('https://ipapi.co/json/');
        const userData = response.data;
        console.log("Location data from ipapi.co:", userData);
        
        // Set UAE as default for testing
        if (userData?.country_code === 'AE' || userData?.country_name === 'United Arab Emirates') {
          console.log("UAE detected, setting as default country");
          const uaeCountry = countries.find(c => c.code === 'AE');
          if (uaeCountry) {
            setSelectedCountry(uaeCountry.name);
            setCountryCode('ae');
            formik.setFieldValue('country', uaeCountry.name);
            return;
          }
        }
        
        const countryNames = countries.map(c => c.name);
        
        if (userData?.country_name && countryNames.includes(userData.country_name)) {
          console.log(`Setting country to ${userData.country_name}`);
          setSelectedCountry(userData.country_name);
          const detectedCountryCode = userData.country_code.toLowerCase();
          setCountryCode(detectedCountryCode);
          
          // Update country with the detected country
          formik.setFieldValue('country', userData.country_name);
        } else if (userData?.country_code) {
          // Try to find country by code if name doesn't match
          const countryByCode = countries.find(c => c.code === userData.country_code.toUpperCase());
          if (countryByCode) {
            console.log(`Found country by code: ${countryByCode.name}`);
            setSelectedCountry(countryByCode.name);
            setCountryCode(userData.country_code.toLowerCase());
            formik.setFieldValue('country', countryByCode.name);
          } else {
            // Default to UAE for this specific issue
            const defaultCountry = countries.find(c => c.code === 'AE') || countries.find(c => c.name === 'United Arab Emirates');
            console.log(`No matching country found, defaulting to ${defaultCountry.name}`);
            setSelectedCountry(defaultCountry.name);
            setCountryCode(defaultCountry.code.toLowerCase());
            formik.setFieldValue('country', defaultCountry.name);
          }
        } else {
          // Default to UAE for this specific issue
          const defaultCountry = countries.find(c => c.code === 'AE') || countries.find(c => c.name === 'United Arab Emirates');
          console.log(`No country data, defaulting to ${defaultCountry.name}`);
          setSelectedCountry(defaultCountry.name);
          setCountryCode(defaultCountry.code.toLowerCase());
          formik.setFieldValue('country', defaultCountry.name);
        }
      } catch (error) {
        console.error("Failed to fetch location data", error);
        // Default to UAE for this specific issue
        const defaultCountry = countries.find(c => c.code === 'AE') || countries.find(c => c.name === 'United Arab Emirates');
        console.log(`Error fetching location, defaulting to ${defaultCountry.name}`);
        setSelectedCountry(defaultCountry.name);
        setCountryCode(defaultCountry.code.toLowerCase());
        formik.setFieldValue('country', defaultCountry.name);
      } finally {
        setGeoLocationLoading(false);
      }
    };

    fetchLocationData();
  }, [formik.setFieldValue]);

  // Handle pincode lookup
  const handlePincodeLookup = async (pincode) => {
    // Validate pincode format based on country
    if (!pincode) return;
    
    // Reset success state
    setPincodeSuccess(false);
    
    console.log(`Looking up pincode: ${pincode} for country code: ${countryCode}`);
    
    // Different countries have different pincode formats
    // For simplicity, we'll just check minimum length
    const minLength = countryCode === 'us' ? 5 : 
                      countryCode === 'ca' ? 6 : 
                      countryCode === 'gb' ? 5 : 
                      countryCode === 'au' ? 4 : 
                      countryCode === 'ae' ? 5 : 5;
                      
    if (pincode.length < minLength) return;
    
    try {
      setPincodeLoading(true);
      setPincodeError(null);
      
      // Use the country code to determine which API endpoint to use
      // Default to 'ae' (UAE) if no country code is set
      const countryCodeForApi = countryCode || 'ae';
      
      console.log(`Using country code for API: ${countryCodeForApi}`);
      
      // Format the pincode based on country requirements
      let formattedPincode = pincode;
      
      // Special handling for certain countries
      if (countryCodeForApi === 'ca') {
        // Canadian postal codes are in format A1A 1A1, but API needs them without spaces
        formattedPincode = pincode.replace(/\s/g, '');
      } else if (countryCodeForApi === 'gb') {
        // UK postcodes may need special handling
        formattedPincode = pincode.replace(/\s/g, '');
      } else if (countryCodeForApi === 'ae') {
        // UAE postcodes are typically 5 digits
        formattedPincode = pincode.replace(/\s/g, '');
        
        // Special handling for UAE postcodes
        // If zippopotam.us doesn't support UAE, we can use a hardcoded mapping for common UAE postcodes
        const uaePostcodes = {
          '00000': { city: 'Abu Dhabi', state: '' },
          '11111': { city: 'Dubai', state: '' },
          '22222': { city: 'Sharjah', state: '' },
          '33333': { city: 'Ajman', state: '' },
          '44444': { city: 'Umm Al Quwain', state: '' },
          '55555': { city: 'Ras Al Khaimah', state: '' },
          '66666': { city: 'Fujairah', state: '' },
          // Add more UAE postcodes as needed
        };
        
        // Check if we have a hardcoded mapping for this UAE postcode
        if (uaePostcodes[formattedPincode]) {
          console.log(`Found hardcoded mapping for UAE postcode: ${formattedPincode}`);
          const uaePlace = uaePostcodes[formattedPincode];
          
          // Update city
          formik.setFieldValue('city', uaePlace.city);
          
          // Update country to UAE
          const uaeCountry = countries.find(c => c.code === 'AE');
          if (uaeCountry) {
            formik.setFieldValue('country', uaeCountry.name);
            setSelectedCountry(uaeCountry.name);
            setCountryCode('ae');
          }
          
          // Set success state
          setPincodeSuccess(true);
          setTimeout(() => {
            setPincodeSuccess(false);
          }, 3000);
          
          setPincodeLoading(false);
          return;
        }
      }
      
      // Call the zippopotam.us API to get location data based on pincode
      console.log(`Calling API: https://api.zippopotam.us/${countryCodeForApi}/${formattedPincode}`);
      const response = await axios.get(`https://api.zippopotam.us/${countryCodeForApi}/${formattedPincode}`);
      
      console.log('API response:', response.data);
      
      if (response.data && response.data.places && response.data.places.length > 0) {
        const place = response.data.places[0];
        let fieldsUpdated = false;
        
        // Update city
        if (place['place name']) {
          console.log(`Setting city to: ${place['place name']}`);
          formik.setFieldValue('city', place['place name']);
          fieldsUpdated = true;
        }
        
        // Get the country name from the response or use the current one
        let countryName = response.data.country;
        console.log(`Country from API: ${countryName}`);
        
        // If the API returned a country name that doesn't match our data structure,
        // try to find a matching country in our list
        if (countryName && !countryStates[countryName]) {
          console.log(`Country name doesn't match our data structure: ${countryName}`);
          // Try to find a matching country by name similarity
          const matchingCountry = Object.keys(countryStates).find(c => 
            c.toLowerCase() === countryName.toLowerCase() || 
            c.toLowerCase().includes(countryName.toLowerCase()) ||
            countryName.toLowerCase().includes(c.toLowerCase())
          );
          
          if (matchingCountry) {
            console.log(`Found matching country: ${matchingCountry}`);
            countryName = matchingCountry;
          }
        }
        
        // If we have a valid country name, update the form
        if (countryName && countryStates[countryName]) {
          // Update country
          console.log(`Setting country to: ${countryName}`);
          formik.setFieldValue('country', countryName);
          setSelectedCountry(countryName);
          fieldsUpdated = true;
          
          // Find the matching country in our countries list to get the code
          const countryObj = countries.find(c => c.name === countryName);
          if (countryObj) {
            console.log(`Setting country code to: ${countryObj.code.toLowerCase()}`);
            setCountryCode(countryObj.code.toLowerCase());
          }
          
          // Update state if the country has states
          if (countryStates[countryName] && countryStates[countryName].hasStates) {
            // Try to find the state in our list
            const stateName = place['state'] || place['state abbreviation'];
            if (stateName) {
              console.log(`State from API: ${stateName}`);
              const statesList = countryStates[countryName].states;
              
              // Find the closest matching state name
              const matchingState = statesList.find(s => 
                s.toLowerCase() === stateName.toLowerCase() || 
                s.toLowerCase().includes(stateName.toLowerCase()) ||
                stateName.toLowerCase().includes(s.toLowerCase())
              );
              
              if (matchingState) {
                console.log(`Setting state to: ${matchingState}`);
                formik.setFieldValue('state', matchingState);
                fieldsUpdated = true;
              }
            }
          }
        }
        
        // Set success state if any fields were updated
        if (fieldsUpdated) {
          console.log('Fields updated successfully');
          setPincodeSuccess(true);
          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            setPincodeSuccess(false);
          }, 3000);
        } else {
          console.log('Found location but could not update fields');
          // Providing a helpful message instead of an error
          setPincodeError('Location found but details could not be auto-filled. You can enter them manually.');
        }
      } else {
        console.log('No location found for this pincode/zipcode');
        // Not showing error for not found pincodes as pincode is optional
      }
    } catch (error) {
      console.error('Error looking up pincode:', error);
      
      // Provide more specific error messages based on the error
      if (error.response) {
        if (error.response.status === 404) {
          console.log('Pincode/zipcode not found');
          // Not showing error for not found pincodes as pincode is optional
        } else {
          console.log(`API error: ${error.response.status}`);
          // Providing a helpful message instead of an error
          setPincodeError(`Unable to lookup pincode (API error). You can enter address details manually.`);
        }
      } else if (error.request) {
        console.log('Network error');
        // Providing a helpful message instead of an error
        setPincodeError('Network issue while looking up pincode. You can enter address details manually.');
      } else {
        console.log('Failed to lookup pincode');
        // Providing a helpful message instead of an error
        setPincodeError('Unable to lookup pincode. You can enter address details manually.');
      }
    } finally {
      setPincodeLoading(false);
    }
  };
  
  // Handle closing the success message
  const handleCloseSuccess = () => {
    setSuccessMessage(null);
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 5, mb: 5 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom align="center">
            Tell us about your business
          </Typography>
          <Typography variant="subtitle1" gutterBottom align="center" color="text.secondary" sx={{ mb: 4 }}>
            This helps us personalize your experience
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          {/* Success message Snackbar */}
          <Snackbar
            open={!!successMessage}
            autoHideDuration={6000}
            onClose={handleCloseSuccess}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert onClose={handleCloseSuccess} severity="success" sx={{ width: '100%' }}>
              {successMessage}
            </Alert>
          </Snackbar>

          <form onSubmit={formik.handleSubmit}>
            <Grid container spacing={3}>
              {/* Business Name */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Business Name"
                  name="businessName"
                  value={formik.values.businessName}
                  onChange={formik.handleChange}
                  error={formik.touched.businessName && Boolean(formik.errors.businessName)}
                  helperText={
                    (formik.touched.businessName && formik.errors.businessName) || 
                    "Official Name used across Accounting documents and reports."
                  }
                  required
                />
              </Grid>

              {/* Website */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Website"
                  name="website"
                  value={formik.values.website}
                  onChange={formik.handleChange}
                  error={formik.touched.website && Boolean(formik.errors.website)}
                  helperText={
                    (formik.touched.website && formik.errors.website) || 
                    "Add your business or work website."
                  }
                  placeholder="Your Work Website"
                />
              </Grid>

              {/* GSTIN */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="GSTIN"
                  name="gstin"
                  value={formik.values.gstin}
                  onChange={formik.handleChange}
                  error={formik.touched.gstin && Boolean(formik.errors.gstin)}
                  helperText={
                    (formik.touched.gstin && formik.errors.gstin) || 
                    "Enter your 15-digit Goods and Services Tax Identification Number"
                  }
                  required
                />
              </Grid>

              {/* PAN */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="PAN"
                  name="pan"
                  value={formik.values.pan}
                  onChange={formik.handleChange}
                  error={formik.touched.pan && Boolean(formik.errors.pan)}
                  helperText={
                    (formik.touched.pan && formik.errors.pan) || 
                    "Enter your 10-character Permanent Account Number"
                  }
                  required
                />
              </Grid>

              {/* Office Address Section */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Office Address
                </Typography>
                
                <Box sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                  <Grid container spacing={2}>
                    {/* Email */}
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Email"
                        name="primaryEmail"
                        value={formik.values.primaryEmail}
                        onChange={formik.handleChange}
                        error={formik.touched.primaryEmail && Boolean(formik.errors.primaryEmail)}
                        helperText={formik.touched.primaryEmail && formik.errors.primaryEmail}
                        required
                      />
                    </Grid>
                    
                    {/* Phone */}
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Phone"
                        name="phone"
                        value={formik.values.phone}
                        onChange={formik.handleChange}
                        error={formik.touched.phone && Boolean(formik.errors.phone)}
                        helperText={
                          (formik.touched.phone && formik.errors.phone) || 
                          "10-digit phone number without spaces or special characters"
                        }
                        required
                      />
                    </Grid>
                    
                    {/* Address Line */}
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Address Line"
                        name="addressLine"
                        value={formik.values.addressLine}
                        onChange={formik.handleChange}
                        error={formik.touched.addressLine && Boolean(formik.errors.addressLine)}
                        helperText={formik.touched.addressLine && formik.errors.addressLine}
                        required
                      />
                    </Grid>
                    
                    {/* City */}
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="City"
                        name="city"
                        value={formik.values.city}
                        onChange={formik.handleChange}
                        error={formik.touched.city && Boolean(formik.errors.city)}
                        helperText={formik.touched.city && formik.errors.city}
                        required
                      />
                    </Grid>
                    
                    {/* State - Only shown if country has states */}
                    {formik.values.country && countryStates[formik.values.country] && countryStates[formik.values.country].hasStates && (
                      <Grid item xs={12} sm={6}>
                        <FormControl 
                          fullWidth
                          error={formik.touched.state && Boolean(formik.errors.state)}
                          required
                        >
                          <InputLabel>State</InputLabel>
                          <Select
                            name="state"
                            value={formik.values.state}
                            onChange={formik.handleChange}
                            label="State"
                          >
                            {countryStates[formik.values.country]?.states?.map((state) => (
                              <MenuItem key={state} value={state}>
                                {state}
                              </MenuItem>
                            ))}
                          </Select>
                          {formik.touched.state && formik.errors.state && (
                            <FormHelperText>
                              {formik.errors.state}
                            </FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                    )}
                    
                    {/* Pincode */}
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Pincode"
                        name="pincode"
                        value={formik.values.pincode}
                        onChange={(e) => {
                          formik.handleChange(e);
                          // Reset success state when pincode changes
                          if (pincodeSuccess) {
                            setPincodeSuccess(false);
                          }
                          // Only trigger lookup if pincode is of sufficient length
                          if (e.target.value.length >= 5) {
                            handlePincodeLookup(e.target.value);
                          }
                        }}
                        onBlur={(e) => {
                          formik.handleBlur(e);
                          // Also trigger on blur to catch cases where user pastes the pincode
                          if (e.target.value.length >= 5) {
                            handlePincodeLookup(e.target.value);
                          }
                        }}
                        error={formik.touched.pincode && Boolean(formik.errors.pincode) || Boolean(pincodeError)}
                        helperText={
                          (formik.touched.pincode && formik.errors.pincode) || 
                          pincodeError ||
                          (pincodeSuccess ? "✓ Location found and fields updated!" : "Enter pincode to auto-fill city, state, and country")
                        }
                        InputProps={{
                          endAdornment: pincodeLoading ? (
                            <InputAdornment position="end">
                              <CircularProgress size={20} />
                            </InputAdornment>
                          ) : pincodeSuccess ? (
                            <InputAdornment position="end">
                              <Box sx={{ color: 'success.main', display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontSize: '1.2rem' }}>✓</span>
                              </Box>
                            </InputAdornment>
                          ) : null
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: pincodeSuccess ? 'success.main' : undefined,
                            },
                          },
                          '& .MuiFormHelperText-root': {
                            color: pincodeSuccess ? 'success.main' : undefined,
                          }
                        }}
                        // Pincode is optional
                      />
                    </Grid>
                    
                    {/* Country */}
                    <Grid item xs={12} sm={6}>
                      <FormControl 
                        fullWidth
                        error={formik.touched.country && Boolean(formik.errors.country)}
                        required
                      >
                        <InputLabel>Country</InputLabel>
                        <Select
                          name="country"
                          value={formik.values.country}
                          onChange={(e) => {
                            formik.setFieldValue('country', e.target.value);
                            setSelectedCountry(e.target.value);
                            const country = countries.find(c => c.name === e.target.value);
                            if (country) {
                              setCountryCode(country.code.toLowerCase());
                            }
                          }}
                          label="Country"
                        >
                          {countries.map((country) => (
                            <MenuItem key={country.code} value={country.name}>
                              {country.name}
                            </MenuItem>
                          ))}
                        </Select>
                        {formik.touched.country && formik.errors.country && (
                          <FormHelperText>
                            {formik.errors.country}
                          </FormHelperText>
                        )}
                      </FormControl>
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              {/* Geolocation Loading Indicator */}
              {geoLocationLoading && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', my: 2 }}>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Detecting your location...
                    </Typography>
                  </Box>
                </Grid>
              )}

              {/* Submit Button */}
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={loading || geoLocationLoading}
                  sx={{ mt: 2 }}
                  startIcon={loading && <CircularProgress size={20} color="inherit" />}
                >
                  {loading ? 'Saving...' : 'Save & Continue'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default BusinessSetupPage;