/**
 * UK Tax Rates Configuration
 * 
 * This module provides comprehensive UK tax rates and thresholds
 * organized by tax type and tax year. Includes bilingual descriptions
 * in English and Turkish.
 * 
 * Tax Year Format: 'YYYY-YY' (e.g., '2025-26' for tax year April 2025 to April 2026)
 */

const taxRates = {
  // Current tax year configuration
  currentTaxYear: '2025-26',
  
  // Tax Years Data
  taxYears: {
    '2025-26': {
      startDate: '2025-04-06',
      endDate: '2026-04-05',
      
      // Income Tax Rates (England, Wales, Northern Ireland)
      incomeTax: {
        description: {
          en: 'Income Tax rates for England, Wales and Northern Ireland',
          tr: 'İngiltere, Galler ve Kuzey İrlanda için Gelir Vergisi oranları'
        },
        personalAllowance: {
          amount: 12570,
          incomeLimit: 100000,
          taperRate: 0.5, // £1 reduction for every £2 over income limit
          description: {
            en: 'Tax-free Personal Allowance',
            tr: 'Vergisiz Kişisel Ödenek'
          }
        },
        bands: [
          {
            name: 'personal_allowance',
            rate: 0,
            min: 0,
            max: 12570,
            description: {
              en: 'Personal Allowance - Tax Free',
              tr: 'Kişisel Ödenek - Vergisiz'
            }
          },
          {
            name: 'basic',
            rate: 0.20,
            min: 12571,
            max: 50270,
            description: {
              en: 'Basic Rate',
              tr: 'Temel Oran'
            }
          },
          {
            name: 'higher',
            rate: 0.40,
            min: 50271,
            max: 125140,
            description: {
              en: 'Higher Rate',
              tr: 'Yüksek Oran'
            }
          },
          {
            name: 'additional',
            rate: 0.45,
            min: 125141,
            max: null, // No upper limit
            description: {
              en: 'Additional Rate',
              tr: 'Ek Oran'
            }
          }
        ]
      },
      
      // Scottish Income Tax Rates
      scottishIncomeTax: {
        description: {
          en: 'Income Tax rates for Scotland',
          tr: 'İskoçya için Gelir Vergisi oranları'
        },
        personalAllowance: {
          amount: 12570,
          incomeLimit: 100000,
          taperRate: 0.5,
          description: {
            en: 'Tax-free Personal Allowance',
            tr: 'Vergisiz Kişisel Ödenek'
          }
        },
        bands: [
          {
            name: 'personal_allowance',
            rate: 0,
            min: 0,
            max: 12570,
            description: {
              en: 'Personal Allowance - Tax Free',
              tr: 'Kişisel Ödenek - Vergisiz'
            }
          },
          {
            name: 'starter',
            rate: 0.19,
            min: 12571,
            max: 15397,
            description: {
              en: 'Starter Rate',
              tr: 'Başlangıç Oranı'
            }
          },
          {
            name: 'basic',
            rate: 0.20,
            min: 15398,
            max: 27491,
            description: {
              en: 'Basic Rate',
              tr: 'Temel Oran'
            }
          },
          {
            name: 'intermediate',
            rate: 0.21,
            min: 27492,
            max: 43662,
            description: {
              en: 'Intermediate Rate',
              tr: 'Ara Oran'
            }
          },
          {
            name: 'higher',
            rate: 0.42,
            min: 43663,
            max: 75000,
            description: {
              en: 'Higher Rate',
              tr: 'Yüksek Oran'
            }
          },
          {
            name: 'advanced',
            rate: 0.45,
            min: 75001,
            max: 125140,
            description: {
              en: 'Advanced Rate',
              tr: 'İleri Oran'
            }
          },
          {
            name: 'top',
            rate: 0.48,
            min: 125141,
            max: null,
            description: {
              en: 'Top Rate',
              tr: 'En Yüksek Oran'
            }
          }
        ]
      },
      
      // National Insurance Contributions (NIC)
      nationalInsurance: {
        description: {
          en: 'National Insurance Contributions rates and thresholds',
          tr: 'Ulusal Sigorta Katkı Payı oranları ve eşikleri'
        },
        class1: {
          description: {
            en: 'Class 1 NIC for Employees',
            tr: 'Çalışanlar için Sınıf 1 Ulusal Sigorta'
          },
          employee: {
            thresholds: {
              lowerEarningsLimit: {
                weekly: 125,
                monthly: 542,
                annual: 6500,
                description: {
                  en: 'Lower Earnings Limit (LEL)',
                  tr: 'Alt Kazanç Limiti'
                }
              },
              primaryThreshold: {
                weekly: 242,
                monthly: 1048,
                annual: 12570,
                description: {
                  en: 'Primary Threshold (PT)',
                  tr: 'Birincil Eşik'
                }
              },
              upperEarningsLimit: {
                weekly: 967,
                monthly: 4189,
                annual: 50270,
                description: {
                  en: 'Upper Earnings Limit (UEL)',
                  tr: 'Üst Kazanç Limiti'
                }
              }
            },
            rates: {
              belowPT: 0,
              mainRate: 0.08,
              reducedRate: 0.02,
              description: {
                en: '8% between PT and UEL, 2% above UEL',
                tr: 'PT ve UEL arasında %8, UEL üzerinde %2'
              }
            }
          },
          employer: {
            thresholds: {
              secondaryThreshold: {
                weekly: 175,
                monthly: 758,
                annual: 5000,
                description: {
                  en: 'Secondary Threshold (ST)',
                  tr: 'İkincil Eşik'
                }
              }
            },
            rates: {
              mainRate: 0.15,
              description: {
                en: '15% on earnings above Secondary Threshold',
                tr: 'İkincil Eşik üzerinde %15'
              }
            }
          }
        },
        class2: {
          description: {
            en: 'Class 2 NIC for Self-Employed',
            tr: 'Serbest Çalışanlar için Sınıf 2 Ulusal Sigorta'
          },
          weeklyRate: 3.45,
          smallProfitsThreshold: 6725,
          voluntary: true
        },
        class4: {
          description: {
            en: 'Class 4 NIC for Self-Employed profits',
            tr: 'Serbest Çalışan kârları için Sınıf 4 Ulusal Sigorta'
          },
          lowerProfitsLimit: 12570,
          upperProfitsLimit: 50270,
          mainRate: 0.06,
          additionalRate: 0.02,
          rates: {
            description: {
              en: '6% between lower and upper profits limits, 2% above upper limit',
              tr: 'Alt ve üst kâr limitleri arasında %6, üst limit üzerinde %2'
            }
          }
        }
      },
      
      // Value Added Tax (VAT)
      vat: {
        description: {
          en: 'Value Added Tax rates',
          tr: 'Katma Değer Vergisi oranları'
        },
        rates: {
          standard: {
            rate: 0.20,
            description: {
              en: 'Standard Rate - Most goods and services',
              tr: 'Standart Oran - Çoğu mal ve hizmet'
            }
          },
          reduced: {
            rate: 0.05,
            description: {
              en: 'Reduced Rate - Home energy, child car seats, etc.',
              tr: 'İndirimli Oran - Ev enerjisi, çocuk araba koltukları vb.'
            }
          },
          zero: {
            rate: 0,
            description: {
              en: 'Zero Rate - Food, books, children\'s clothing, etc.',
              tr: 'Sıfır Oran - Gıda, kitaplar, çocuk giysileri vb.'
            }
          }
        },
        thresholds: {
          registration: {
            amount: 90000,
            description: {
              en: 'VAT Registration Threshold',
              tr: 'KDV Kayıt Eşiği'
            }
          },
          deregistration: {
            amount: 88000,
            description: {
              en: 'VAT Deregistration Threshold',
              tr: 'KDV Kayıt Silme Eşiği'
            }
          }
        },
        // Warning levels for VAT registration threshold monitoring
        // These are percentages of the registration threshold
        warningLevels: {
          approaching: {
            percentage: 0.75, // 75% of threshold
            description: {
              en: 'Approaching VAT threshold - You are at 75% or more of the VAT registration threshold',
              tr: 'KDV eşiğine yaklaşıyorsunuz - KDV kayıt eşiğinin %75 veya üzerinde bulunuyorsunuz'
            }
          },
          imminent: {
            percentage: 0.90, // 90% of threshold
            description: {
              en: 'VAT registration imminent - You are at 90% or more of the VAT registration threshold',
              tr: 'KDV kaydı yakın - KDV kayıt eşiğinin %90 veya üzerinde bulunuyorsunuz'
            }
          },
          exceeded: {
            percentage: 1.00, // 100% of threshold
            description: {
              en: 'VAT threshold exceeded - You must register for VAT within 30 days',
              tr: 'KDV eşiği aşıldı - 30 gün içinde KDV kaydı yaptırmanız gerekiyor'
            }
          }
        },
        flatRateScheme: {
          description: {
            en: 'VAT Flat Rate Scheme',
            tr: 'KDV Sabit Oran Planı'
          },
          eligibilityThreshold: 150000,
          firstYearDiscount: 0.01
        }
      },
      
      // Corporation Tax
      corporationTax: {
        description: {
          en: 'Corporation Tax rates for company profits',
          tr: 'Şirket kârları için Kurumlar Vergisi oranları'
        },
        rates: {
          small: {
            rate: 0.19,
            profitsThreshold: 50000,
            description: {
              en: 'Small Profits Rate - Profits up to £50,000',
              tr: 'Küçük Kâr Oranı - 50.000 £\'a kadar kârlar'
            }
          },
          main: {
            rate: 0.25,
            profitsThreshold: 250000,
            description: {
              en: 'Main Rate - Profits over £250,000',
              tr: 'Ana Oran - 250.000 £ üzerinde kârlar'
            }
          },
          marginal: {
            lowerLimit: 50000,
            upperLimit: 250000,
            marginalReliefFraction: 0.015,
            description: {
              en: 'Marginal Relief - Profits between £50,000 and £250,000',
              tr: 'Marjinal İndirim - 50.000 £ ve 250.000 £ arasındaki kârlar'
            }
          }
        }
      },
      
      // Dividend Tax
      dividendTax: {
        description: {
          en: 'Tax rates on dividend income',
          tr: 'Temettü geliri vergi oranları'
        },
        allowance: {
          amount: 500,
          description: {
            en: 'Tax-free Dividend Allowance',
            tr: 'Vergisiz Temettü Ödeneği'
          }
        },
        rates: {
          basic: {
            rate: 0.0875,
            description: {
              en: 'Basic Rate taxpayers',
              tr: 'Temel Oran vergi mükellefleri'
            }
          },
          higher: {
            rate: 0.3375,
            description: {
              en: 'Higher Rate taxpayers',
              tr: 'Yüksek Oran vergi mükellefleri'
            }
          },
          additional: {
            rate: 0.3935,
            description: {
              en: 'Additional Rate taxpayers',
              tr: 'Ek Oran vergi mükellefleri'
            }
          }
        }
      },
      
      // Capital Gains Tax
      capitalGainsTax: {
        description: {
          en: 'Capital Gains Tax rates and allowances',
          tr: 'Sermaye Kazancı Vergisi oranları ve ödenekleri'
        },
        annualExemption: {
          individual: 3000,
          trust: 1500,
          description: {
            en: 'Annual Exempt Amount',
            tr: 'Yıllık Muaf Tutar'
          }
        },
        rates: {
          basic: {
            residential: 0.18,
            other: 0.10,
            description: {
              en: 'Basic Rate - 18% residential property, 10% other assets',
              tr: 'Temel Oran - Konut %18, diğer varlıklar %10'
            }
          },
          higher: {
            residential: 0.24,
            other: 0.20,
            description: {
              en: 'Higher/Additional Rate - 24% residential property, 20% other assets',
              tr: 'Yüksek/Ek Oran - Konut %24, diğer varlıklar %20'
            }
          }
        },
        businessAssetDisposal: {
          rate: 0.10,
          lifetimeLimit: 1000000,
          description: {
            en: 'Business Asset Disposal Relief (formerly Entrepreneurs\' Relief)',
            tr: 'İş Varlığı Elden Çıkarma İndirimi (eski adıyla Girişimci İndirimi)'
          }
        }
      },
      
      // Inheritance Tax
      inheritanceTax: {
        description: {
          en: 'Inheritance Tax thresholds and rates',
          tr: 'Veraset Vergisi eşikleri ve oranları'
        },
        nilRateBand: {
          amount: 325000,
          description: {
            en: 'Nil-Rate Band (tax-free threshold)',
            tr: 'Sıfır Oran Bandı (vergisiz eşik)'
          }
        },
        residenceNilRateBand: {
          amount: 175000,
          taperThreshold: 2000000,
          description: {
            en: 'Residence Nil-Rate Band (for family home)',
            tr: 'Konut Sıfır Oran Bandı (aile evi için)'
          }
        },
        rate: 0.40,
        charityRate: 0.36,
        rates: {
          description: {
            en: '40% standard rate, 36% if 10%+ left to charity',
            tr: 'Standart oran %40, hayır kurumlarına %10+ bırakılırsa %36'
          }
        }
      },
      
      // Stamp Duty Land Tax (England & Northern Ireland)
      stampDutyLandTax: {
        description: {
          en: 'Stamp Duty Land Tax for property purchases in England & Northern Ireland',
          tr: 'İngiltere ve Kuzey İrlanda\'da mülk alımları için Damga Vergisi'
        },
        residential: {
          standard: {
            bands: [
              { min: 0, max: 125000, rate: 0 },
              { min: 125001, max: 250000, rate: 0.02 },
              { min: 250001, max: 925000, rate: 0.05 },
              { min: 925001, max: 1500000, rate: 0.10 },
              { min: 1500001, max: null, rate: 0.12 }
            ],
            description: {
              en: 'Standard residential rates',
              tr: 'Standart konut oranları'
            }
          },
          firstTimeBuyer: {
            threshold: 425000,
            maxValue: 625000,
            bands: [
              { min: 0, max: 425000, rate: 0 },
              { min: 425001, max: 625000, rate: 0.05 }
            ],
            description: {
              en: 'First-time buyer relief',
              tr: 'İlk kez ev alan indirimi'
            }
          },
          additionalProperty: {
            surcharge: 0.03,
            description: {
              en: '3% surcharge on additional properties',
              tr: 'Ek mülkler için %3 ek ücret'
            }
          }
        },
        nonResidential: {
          bands: [
            { min: 0, max: 150000, rate: 0 },
            { min: 150001, max: 250000, rate: 0.02 },
            { min: 250001, max: null, rate: 0.05 }
          ],
          description: {
            en: 'Non-residential and mixed-use rates',
            tr: 'Ticari ve karma kullanım oranları'
          }
        }
      },
      
      // Student Loan Repayments
      studentLoan: {
        description: {
          en: 'Student Loan repayment thresholds and rates',
          tr: 'Öğrenci Kredisi geri ödeme eşikleri ve oranları'
        },
        plans: {
          plan1: {
            threshold: 24990,
            rate: 0.09,
            description: {
              en: 'Plan 1 (pre-2012 England/Wales, Scotland, NI)',
              tr: 'Plan 1 (2012 öncesi İngiltere/Galler, İskoçya, Kuzey İrlanda)'
            }
          },
          plan2: {
            threshold: 27295,
            rate: 0.09,
            description: {
              en: 'Plan 2 (post-2012 England/Wales)',
              tr: 'Plan 2 (2012 sonrası İngiltere/Galler)'
            }
          },
          plan4: {
            threshold: 31395,
            rate: 0.09,
            description: {
              en: 'Plan 4 (Scotland post-2021)',
              tr: 'Plan 4 (2021 sonrası İskoçya)'
            }
          },
          plan5: {
            threshold: 25000,
            rate: 0.09,
            description: {
              en: 'Plan 5 (post-2023 England)',
              tr: 'Plan 5 (2023 sonrası İngiltere)'
            }
          },
          postgraduate: {
            threshold: 21000,
            rate: 0.06,
            description: {
              en: 'Postgraduate Loan',
              tr: 'Yüksek Lisans Kredisi'
            }
          }
        }
      },
      
      // Pension Contributions
      pension: {
        description: {
          en: 'Pension contribution limits and allowances',
          tr: 'Emeklilik katkı limitleri ve ödenekleri'
        },
        annualAllowance: {
          standard: 60000,
          taperThreshold: 260000,
          minimumAllowance: 10000,
          description: {
            en: 'Annual Allowance for tax-relieved pension contributions',
            tr: 'Vergi indirimli emeklilik katkıları için Yıllık Ödenek'
          }
        },
        moneyPurchaseAnnualAllowance: {
          amount: 10000,
          description: {
            en: 'Money Purchase Annual Allowance (after accessing pension flexibly)',
            tr: 'Para Satın Alma Yıllık Ödeneği (esnek emeklilik erişiminden sonra)'
          }
        },
        lifetimeAllowance: {
          abolished: true,
          effectiveDate: '2024-04-06',
          description: {
            en: 'Lifetime Allowance abolished from April 2024',
            tr: 'Ömür Boyu Ödenek Nisan 2024\'ten itibaren kaldırıldı'
          }
        },
        statePension: {
          fullWeekly: 221.20,
          fullAnnual: 11502.40,
          qualifyingYears: 35,
          minimumYears: 10,
          description: {
            en: 'New State Pension amounts',
            tr: 'Yeni Devlet Emekli Maaşı tutarları'
          }
        }
      },
      
      // Minimum Wage / Living Wage
      minimumWage: {
        description: {
          en: 'National Minimum Wage and National Living Wage rates',
          tr: 'Ulusal Asgari Ücret ve Ulusal Yaşam Ücreti oranları'
        },
        rates: {
          nationalLivingWage: {
            age: 21,
            hourlyRate: 12.21,
            description: {
              en: 'National Living Wage (21 and over)',
              tr: 'Ulusal Yaşam Ücreti (21 yaş ve üzeri)'
            }
          },
          age18To20: {
            hourlyRate: 10.00,
            description: {
              en: '18-20 Year Old Rate',
              tr: '18-20 Yaş Oranı'
            }
          },
          under18: {
            hourlyRate: 7.55,
            description: {
              en: 'Under 18 Rate',
              tr: '18 Yaş Altı Oranı'
            }
          },
          apprentice: {
            hourlyRate: 7.55,
            description: {
              en: 'Apprentice Rate',
              tr: 'Çırak Oranı'
            }
          }
        }
      },
      
      // Statutory Payments
      statutoryPayments: {
        description: {
          en: 'Statutory payment rates',
          tr: 'Yasal ödeme oranları'
        },
        ssp: {
          weeklyRate: 118.75,
          waitingDays: 3,
          description: {
            en: 'Statutory Sick Pay (SSP)',
            tr: 'Yasal Hastalık Ödeneği'
          }
        },
        smp: {
          first6Weeks: 0.90,
          remainingWeeks: 184.03,
          description: {
            en: 'Statutory Maternity Pay (SMP) - 90% for 6 weeks, then flat rate',
            tr: 'Yasal Doğum Ödeneği - 6 hafta %90, sonra sabit oran'
          }
        },
        spp: {
          weeklyRate: 184.03,
          weeks: 2,
          description: {
            en: 'Statutory Paternity Pay (SPP)',
            tr: 'Yasal Babalık Ödeneği'
          }
        },
        shpp: {
          weeklyRate: 184.03,
          description: {
            en: 'Statutory Shared Parental Pay',
            tr: 'Yasal Paylaşımlı Ebeveyn Ödeneği'
          }
        }
      }
    },
    
    // Previous tax year for reference
    '2024-25': {
      startDate: '2024-04-06',
      endDate: '2025-04-05',
      
      incomeTax: {
        description: {
          en: 'Income Tax rates for England, Wales and Northern Ireland',
          tr: 'İngiltere, Galler ve Kuzey İrlanda için Gelir Vergisi oranları'
        },
        personalAllowance: {
          amount: 12570,
          incomeLimit: 100000,
          taperRate: 0.5,
          description: {
            en: 'Tax-free Personal Allowance',
            tr: 'Vergisiz Kişisel Ödenek'
          }
        },
        bands: [
          {
            name: 'personal_allowance',
            rate: 0,
            min: 0,
            max: 12570,
            description: {
              en: 'Personal Allowance - Tax Free',
              tr: 'Kişisel Ödenek - Vergisiz'
            }
          },
          {
            name: 'basic',
            rate: 0.20,
            min: 12571,
            max: 50270,
            description: {
              en: 'Basic Rate',
              tr: 'Temel Oran'
            }
          },
          {
            name: 'higher',
            rate: 0.40,
            min: 50271,
            max: 125140,
            description: {
              en: 'Higher Rate',
              tr: 'Yüksek Oran'
            }
          },
          {
            name: 'additional',
            rate: 0.45,
            min: 125141,
            max: null,
            description: {
              en: 'Additional Rate',
              tr: 'Ek Oran'
            }
          }
        ]
      },
      
      nationalInsurance: {
        description: {
          en: 'National Insurance Contributions rates and thresholds',
          tr: 'Ulusal Sigorta Katkı Payı oranları ve eşikleri'
        },
        class1: {
          description: {
            en: 'Class 1 NIC for Employees',
            tr: 'Çalışanlar için Sınıf 1 Ulusal Sigorta'
          },
          employee: {
            thresholds: {
              lowerEarningsLimit: {
                weekly: 123,
                monthly: 533,
                annual: 6396,
                description: {
                  en: 'Lower Earnings Limit (LEL)',
                  tr: 'Alt Kazanç Limiti'
                }
              },
              primaryThreshold: {
                weekly: 242,
                monthly: 1048,
                annual: 12570,
                description: {
                  en: 'Primary Threshold (PT)',
                  tr: 'Birincil Eşik'
                }
              },
              upperEarningsLimit: {
                weekly: 967,
                monthly: 4189,
                annual: 50270,
                description: {
                  en: 'Upper Earnings Limit (UEL)',
                  tr: 'Üst Kazanç Limiti'
                }
              }
            },
            rates: {
              belowPT: 0,
              mainRate: 0.08,
              reducedRate: 0.02,
              description: {
                en: '8% between PT and UEL, 2% above UEL',
                tr: 'PT ve UEL arasında %8, UEL üzerinde %2'
              }
            }
          },
          employer: {
            thresholds: {
              secondaryThreshold: {
                weekly: 175,
                monthly: 758,
                annual: 9100,
                description: {
                  en: 'Secondary Threshold (ST)',
                  tr: 'İkincil Eşik'
                }
              }
            },
            rates: {
              mainRate: 0.138,
              description: {
                en: '13.8% on earnings above Secondary Threshold',
                tr: 'İkincil Eşik üzerinde %13.8'
              }
            }
          }
        }
      },
      
      vat: {
        description: {
          en: 'Value Added Tax rates',
          tr: 'Katma Değer Vergisi oranları'
        },
        rates: {
          standard: {
            rate: 0.20,
            description: {
              en: 'Standard Rate',
              tr: 'Standart Oran'
            }
          },
          reduced: {
            rate: 0.05,
            description: {
              en: 'Reduced Rate',
              tr: 'İndirimli Oran'
            }
          },
          zero: {
            rate: 0,
            description: {
              en: 'Zero Rate',
              tr: 'Sıfır Oran'
            }
          }
        },
        thresholds: {
          registration: {
            amount: 90000,
            description: {
              en: 'VAT Registration Threshold',
              tr: 'KDV Kayıt Eşiği'
            }
          },
          deregistration: {
            amount: 88000,
            description: {
              en: 'VAT Deregistration Threshold',
              tr: 'KDV Kayıt Silme Eşiği'
            }
          }
        }
      },
      
      corporationTax: {
        description: {
          en: 'Corporation Tax rates for company profits',
          tr: 'Şirket kârları için Kurumlar Vergisi oranları'
        },
        rates: {
          small: {
            rate: 0.19,
            profitsThreshold: 50000,
            description: {
              en: 'Small Profits Rate',
              tr: 'Küçük Kâr Oranı'
            }
          },
          main: {
            rate: 0.25,
            profitsThreshold: 250000,
            description: {
              en: 'Main Rate',
              tr: 'Ana Oran'
            }
          }
        }
      }
    }
  }
};

/**
 * Get tax rates for a specific tax year
 * @param {string} taxYear - Tax year in format 'YYYY-YY' (e.g., '2025-26')
 * @returns {Object|null} Tax rates for the specified year or null if not found
 */
function getTaxRatesForYear(taxYear) {
  return taxRates.taxYears[taxYear] || null;
}

/**
 * Get current tax year rates
 * @returns {Object} Current tax year rates
 */
function getCurrentTaxRates() {
  return taxRates.taxYears[taxRates.currentTaxYear];
}

/**
 * Get specific tax type rates for a given year
 * @param {string} taxType - Type of tax (e.g., 'incomeTax', 'vat', 'corporationTax')
 * @param {string} taxYear - Tax year (optional, defaults to current)
 * @returns {Object|null} Tax rates for the specified type
 */
function getTaxTypeRates(taxType, taxYear = taxRates.currentTaxYear) {
  const yearRates = taxRates.taxYears[taxYear];
  if (!yearRates) return null;
  return yearRates[taxType] || null;
}

/**
 * Get all available tax years
 * @returns {string[]} Array of available tax years
 */
function getAvailableTaxYears() {
  return Object.keys(taxRates.taxYears);
}

/**
 * Get all tax types available for a given year
 * @param {string} taxYear - Tax year (optional, defaults to current)
 * @returns {string[]} Array of available tax types
 */
function getAvailableTaxTypes(taxYear = taxRates.currentTaxYear) {
  const yearRates = taxRates.taxYears[taxYear];
  if (!yearRates) return [];
  return Object.keys(yearRates).filter(key => 
    key !== 'startDate' && key !== 'endDate'
  );
}

/**
 * Calculate income tax for a given annual income
 * @param {number} annualIncome - Annual income in GBP
 * @param {string} region - 'england' or 'scotland' (default: 'england')
 * @param {string} taxYear - Tax year (optional, defaults to current)
 * @returns {Object} Tax calculation breakdown
 */
function calculateIncomeTax(annualIncome, region = 'england', taxYear = taxRates.currentTaxYear) {
  const yearRates = taxRates.taxYears[taxYear];
  if (!yearRates) {
    throw new Error(`Tax year ${taxYear} not found`);
  }
  
  const taxConfig = region === 'scotland' 
    ? yearRates.scottishIncomeTax 
    : yearRates.incomeTax;
  
  if (!taxConfig) {
    throw new Error(`Tax configuration for region ${region} not found`);
  }
  
  // Calculate adjusted personal allowance
  let personalAllowance = taxConfig.personalAllowance.amount;
  if (annualIncome > taxConfig.personalAllowance.incomeLimit) {
    const reduction = Math.floor(
      (annualIncome - taxConfig.personalAllowance.incomeLimit) * 
      taxConfig.personalAllowance.taperRate
    );
    personalAllowance = Math.max(0, personalAllowance - reduction);
  }
  
  const taxableIncome = Math.max(0, annualIncome - personalAllowance);
  
  let totalTax = 0;
  const breakdown = [];
  let remainingIncome = taxableIncome;
  
  for (const band of taxConfig.bands) {
    if (band.rate === 0) continue;
    
    const bandMin = Math.max(0, band.min - personalAllowance);
    const bandMax = band.max ? band.max - personalAllowance : Infinity;
    
    if (remainingIncome <= 0) break;
    
    const taxableInBand = Math.min(
      remainingIncome,
      bandMax - bandMin
    );
    
    if (taxableInBand > 0) {
      const taxInBand = taxableInBand * band.rate;
      totalTax += taxInBand;
      breakdown.push({
        band: band.name,
        rate: band.rate,
        taxableAmount: taxableInBand,
        tax: taxInBand
      });
      remainingIncome -= taxableInBand;
    }
  }
  
  return {
    annualIncome,
    personalAllowance,
    taxableIncome,
    totalTax: Math.round(totalTax * 100) / 100,
    effectiveRate: annualIncome > 0 
      ? Math.round((totalTax / annualIncome) * 10000) / 100 
      : 0,
    breakdown
  };
}

module.exports = {
  taxRates,
  getTaxRatesForYear,
  getCurrentTaxRates,
  getTaxTypeRates,
  getAvailableTaxYears,
  getAvailableTaxTypes,
  calculateIncomeTax
};
