import { useState, useEffect } from 'react';
import {
  Modal,
  Stepper,
  TextInput,
  Textarea,
  Button,
  Group,
  Stack,
  Switch,
  NumberInput,
  Select,
  Chip,
  Text,
  SimpleGrid
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  IconUser, 
  IconHeart, 
  IconCertificate,
  IconArrowRight,
  IconArrowLeft,
  IconCheck,
  IconMail
} from '@tabler/icons-react';
import type { Doctor, DoctorFormData } from '@/types';
import { api } from '@/lib/api';
import styles from './DoctorWizard.module.css';

interface DoctorWizardProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: Doctor | null;
}

const specializations = [
  'General Physician',
  'Cardiologist',
  'Orthopedic Surgeon',
  'Pediatrician',
  'Dermatologist',
  'Neurologist',
  'Psychiatrist',
  'Gynecologist',
  'ENT Specialist',
  'Ophthalmologist',
  'Gastroenterologist',
  'Urologist',
  'Pulmonologist',
  'Oncologist',
  'Endocrinologist',
  'Rheumatologist',
  'Nephrologist',
  'General Surgeon',
  'Dentist',
  'Ayurvedic',
  'Homeopathic',
  'Physiotherapist',
  'Other'
];

const qualifications = [
  'MBBS',
  'MD',
  'MS',
  'MBBS, MD',
  'MBBS, MS',
  'MBBS, DNB',
  'MBBS, DM',
  'MBBS, MCh',
  'BDS',
  'MDS',
  'BAMS',
  'BHMS',
  'BPT',
  'MPT',
  'Other'
];

const initialFormData: DoctorFormData = {
  name: '',
  contact: '',
  address: '',
  birthDate: null,
  isMarried: false,
  spouseName: '',
  anniversary: null,
  childrenCount: 0,
  childrenNames: [],
  qualification: '',
  specialization: '',
  registrationNo: '',
  email: '',
  experienceYrs: 0
};

const stepVariants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 }
};

export default function DoctorWizard({ opened, onClose, onSuccess, editData }: DoctorWizardProps) {
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<DoctorFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes or edit data changes
  useEffect(() => {
    if (opened) {
      if (editData) {
        setFormData({
          name: editData.name,
          contact: editData.contact,
          address: editData.address,
          birthDate: editData.birthDate ? new Date(editData.birthDate) : null,
          isMarried: editData.isMarried,
          spouseName: editData.spouseName || '',
          anniversary: editData.anniversary ? new Date(editData.anniversary) : null,
          childrenCount: editData.childrenCount,
          childrenNames: editData.childrenNames ? JSON.parse(editData.childrenNames) : [],
          qualification: editData.qualification,
          specialization: editData.specialization,
          registrationNo: editData.registrationNo || '',
          email: editData.email || '',
          experienceYrs: editData.experienceYrs || 0
        });
      } else {
        setFormData(initialFormData);
      }
      setActive(0);
      setErrors({});
    }
  }, [opened, editData]);

  const updateField = <K extends keyof DoctorFormData>(field: K, value: DoctorFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Contact validation
    const cleanContact = formData.contact.replace(/\s/g, '');
    if (!cleanContact) {
      newErrors.contact = 'Contact is required';
    } else if (!/^(?:\+91|91)?[4-9]\d{9}$/.test(cleanContact)) {
      newErrors.contact = 'Must be a valid Indian mobile number (+91 XXXXXXXXXX)';
    }

    // Email validation (optional)
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address';
    }

    // Address validation
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.qualification) newErrors.qualification = 'Qualification is required';
    if (!formData.specialization) newErrors.specialization = 'Specialization is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (active === 0 && !validateStep1()) return;
    setActive(prev => prev + 1);
  };

  const handleBack = () => {
    setActive(prev => prev - 1);
  };

  const handleSkip = () => {
    // Skip step 2 (personal details - optional)
    setActive(2);
  };

  const handleSave = async () => {
    if (!validateStep3()) return;

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        contact: formData.contact,
        address: formData.address,
        email: formData.email || null,
        birthDate: formData.birthDate 
          ? (typeof formData.birthDate === 'string' ? new Date(formData.birthDate).toISOString() : (formData.birthDate as Date).toISOString())
          : null,
        isMarried: formData.isMarried,
        spouseName: formData.spouseName || null,
        anniversary: formData.anniversary 
          ? (typeof formData.anniversary === 'string' ? new Date(formData.anniversary).toISOString() : (formData.anniversary as Date).toISOString())
          : null,
        childrenCount: formData.childrenCount,
        childrenNames: formData.childrenNames.length > 0 ? JSON.stringify(formData.childrenNames) : null,
        qualification: formData.qualification,
        specialization: formData.specialization,
        registrationNo: formData.registrationNo,
        experienceYrs: formData.experienceYrs
      };

      let result;
      if (editData) {
        result = await api.put(`/api/doctors/${editData.id}`, payload);
      } else {
        result = await api.post('/api/doctors', payload);
      }

      if (result.success) {
        notifications.show({
          title: editData ? 'Doctor Updated' : 'Doctor Added',
          message: `${formData.name} has been ${editData ? 'updated' : 'added'} successfully`,
          color: 'green'
        });
        onSuccess();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save doctor details.',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateChildName = (index: number, value: string) => {
    const newNames = [...formData.childrenNames];
    newNames[index] = value;
    updateField('childrenNames', newNames);
  };

  useEffect(() => {
    // Adjust children names array when count changes
    const currentLength = formData.childrenNames.length;
    if (formData.childrenCount > currentLength) {
      const newNames = [...formData.childrenNames];
      for (let i = currentLength; i < formData.childrenCount; i++) {
        newNames.push('');
      }
      updateField('childrenNames', newNames);
    } else if (formData.childrenCount < currentLength) {
      updateField('childrenNames', formData.childrenNames.slice(0, formData.childrenCount));
    }
  }, [formData.childrenCount]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editData ? 'Edit Doctor' : 'Add New Doctor'}
      size="lg"
      centered
      closeOnClickOutside={false}
    >
      <Stepper active={active} size="sm" className={styles.stepper}>
        <Stepper.Step 
          label="Basic Info" 
          icon={<IconUser size={18} />}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key="step-1"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >
              <Stack gap="md" className={styles.stepContent}>
                <SimpleGrid cols={2}>
                  <TextInput
                    label="Full Name"
                    placeholder="Dr. Full Name"
                    required
                    value={formData.name}
                    onChange={(e) => updateField('name', e.currentTarget.value)}
                    error={errors.name}
                  />
                  <TextInput
                    label="Contact Number"
                    placeholder="+91 98765 43210"
                    required
                    value={formData.contact}
                    onChange={(e) => updateField('contact', e.currentTarget.value)}
                    error={errors.contact}
                  />
                </SimpleGrid>
                <TextInput
                  label="Email Address"
                  placeholder="doctor@example.com"
                  leftSection={<IconMail size={16} />}
                  value={formData.email}
                  onChange={(e) => updateField('email', e.currentTarget.value)}
                  error={errors.email}
                />
                <Textarea
                  label="Address"
                  placeholder="Full address"
                  required
                  rows={3}
                  value={formData.address}
                  onChange={(e) => updateField('address', e.currentTarget.value)}
                  error={errors.address}
                />
              </Stack>
            </motion.div>
          </AnimatePresence>
        </Stepper.Step>

        <Stepper.Step 
          label="Personal Details" 
          description="Optional"
          icon={<IconHeart size={18} />}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key="step-2"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >
              <Stack gap="md" className={styles.stepContent}>
                <DateInput
                  label="Date of Birth"
                  placeholder="Select date"
                  value={formData.birthDate}
                  onChange={(date) => updateField('birthDate', date as Date | null)}
                  maxDate={new Date()}
                  clearable
                />

                <Switch
                  label="Married"
                  checked={formData.isMarried}
                  onChange={(e) => updateField('isMarried', e.currentTarget.checked)}
                />

                {formData.isMarried && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className={styles.marriedFields}
                  >
                    <Text size="sm" c="dimmed" mb="sm">Marriage Details</Text>
                    <Stack gap="md">
                      <SimpleGrid cols={2}>
                        <TextInput
                          label="Spouse Name"
                          placeholder="Spouse's full name"
                          value={formData.spouseName}
                          onChange={(e) => updateField('spouseName', e.currentTarget.value)}
                        />
                        <DateInput
                          label="Anniversary Date"
                          placeholder="Select date"
                          value={formData.anniversary}
                          onChange={(date) => updateField('anniversary', date as Date | null)}
                          maxDate={new Date()}
                          clearable
                        />
                      </SimpleGrid>
                      <NumberInput
                        label="Number of Children"
                        min={0}
                        max={10}
                        value={formData.childrenCount}
                        onChange={(value) => updateField('childrenCount', Number(value) || 0)}
                      />
                      {formData.childrenCount > 0 && (
                        <Stack gap="xs">
                          {[...Array(formData.childrenCount)].map((_, index) => (
                            <TextInput
                              key={index}
                              label={`Child ${index + 1} Name`}
                              placeholder={`Enter child ${index + 1}'s name`}
                              value={formData.childrenNames[index] || ''}
                              onChange={(e) => updateChildName(index, e.currentTarget.value)}
                            />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </motion.div>
                )}
              </Stack>
            </motion.div>
          </AnimatePresence>
        </Stepper.Step>

        <Stepper.Step 
          label="Professional" 
          icon={<IconCertificate size={18} />}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key="step-3"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
            >
              <Stack gap="md" className={styles.stepContent}>
                <SimpleGrid cols={2}>
                  <Select
                    label="Qualification"
                    placeholder="Select qualification"
                    required
                    data={qualifications}
                    value={formData.qualification}
                    onChange={(value) => updateField('qualification', value || '')}
                    error={errors.qualification}
                    searchable
                    allowDeselect={false}
                  />
                  <Select
                    label="Specialization"
                    placeholder="Select specialization"
                    required
                    data={specializations}
                    value={formData.specialization}
                    onChange={(value) => updateField('specialization', value || '')}
                    error={errors.specialization}
                    searchable
                    allowDeselect={false}
                  />
                </SimpleGrid>
                
                <SimpleGrid cols={2}>
                  <TextInput
                    label="Registration Number"
                    placeholder="Medical Council Reg. No"
                    value={formData.registrationNo}
                    onChange={(e) => updateField('registrationNo', e.currentTarget.value)}
                  />
                  <NumberInput
                    label="Years of Experience"
                    placeholder="Years"
                    min={0}
                    max={70}
                    value={formData.experienceYrs}
                    onChange={(val) => updateField('experienceYrs', Number(val) || 0)}
                  />
                </SimpleGrid>

                <div>
                  <Text size="sm" c="dimmed" mb="xs">Quick Select Specialization</Text>
                  <Chip.Group 
                    value={formData.specialization} 
                    onChange={(value) => updateField('specialization', value as string)}
                  >
                    <Group gap="xs">
                      {['General Physician', 'Cardiologist', 'Orthopedic Surgeon', 'Pediatrician', 'Dentist'].map((spec) => (
                        <Chip key={spec} value={spec} size="xs">
                          {spec}
                        </Chip>
                      ))}
                    </Group>
                  </Chip.Group>
                </div>
              </Stack>
            </motion.div>
          </AnimatePresence>
        </Stepper.Step>
      </Stepper>

      {/* Navigation Buttons */}
      <Group justify="space-between" mt="xl">
        {active > 0 ? (
          <Button 
            variant="default" 
            onClick={handleBack}
            leftSection={<IconArrowLeft size={16} />}
          >
            Back
          </Button>
        ) : (
          <Button variant="default" onClick={onClose}>Cancel</Button>
        )}

        <Group>
          {active === 1 && (
            <Button variant="subtle" onClick={handleSkip}>
              Skip
            </Button>
          )}
          
          {active < 2 ? (
            <Button 
              onClick={handleNext}
              rightSection={<IconArrowRight size={16} />}
            >
              Next
            </Button>
          ) : (
            <Button 
              onClick={handleSave} 
              loading={loading}
              color="green"
              leftSection={<IconCheck size={16} />}
            >
              {editData ? 'Update Doctor' : 'Save Doctor'}
            </Button>
          )}
        </Group>
      </Group>
    </Modal>
  );
}
